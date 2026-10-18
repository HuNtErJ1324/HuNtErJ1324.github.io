// Browser editor for drafts/, under `astro dev` only: run `npm run dev`, then
// open http://localhost:4321/edit/. It writes straight to drafts/<slug>.mdx
// and shows the real rendered post beside the source.
//
//   GET  /edit/ and /edit/<slug>     the editor page. It is plain HTML without
//                                    the Vite client, so the full-page reloads
//                                    Astro sends on every content change never
//                                    reset it.
//   GET  /edit/preview/<slug>/       /blog/<slug>/ as Astro renders it, minus
//                                    the Vite client and dev toolbar, so the
//                                    editor decides when the preview reloads
//                                    (it double-buffers two iframes).
//   GET  /edit/api/events            server-sent events: `reload` whenever
//                                    Astro reloads pages, `file` when a draft
//                                    changes on disk.
//   GET  /edit/api/drafts            the drafts, newest edit first
//   POST /edit/api/drafts            create a draft (same template as draft:new)
//   GET  /edit/api/drafts/<slug>     one draft's source and hash
//   PUT  /edit/api/drafts/<slug>     save; 409 if the file changed on disk
//                                    since the editor last saw it
//   GET  /edit/api/components        names in src/components/blog/
//   POST /edit/api/assets/<slug>     save a pasted image under
//                                    public/assets/blog/<slug>/
//
// The client lives in client.js (served and bundled by Vite) and editor.css.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, watch, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { remarkSourceLines } from './remark-source-lines.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const sha = (text) => createHash('sha1').update(text).digest('hex');

const sendJson = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
};

const sendFile = (res, file, type) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    res.end(readFileSync(file));
};

const readBody = (req, limit) => new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
        size += chunk.length;
        if (size > limit) {
            reject(Object.assign(new Error('Request body too large.'), { status: 413 }));
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
});

const escapeAttr = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Astro's error overlay payload carries HTML-rendered markdown
const htmlToText = (html) => html && html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// Writes need a header a cross-site page can't send without a CORS preflight,
// which this server never answers.
const trusted = (req) => req.headers['x-drafts-editor'] === '1' && req.headers['sec-fetch-site'] !== 'cross-site';

// Loaded in astro:server:setup, so `astro build` never imports them.
// MDX parsing matches Astro's: GFM plus the site's own remark plugins (parse()
// only uses their syntax extensions, like remark-math and remark-directive),
// with front matter blanked by Astro's own parser so line numbers stay true
// to the file.
let parseFrontmatter;
let mdx;
async function loadParsers(sitePlugins) {
    const [markdownRemark, mdxJs, gfm] = await Promise.all([
        import('@astrojs/markdown-remark'),
        import('@mdx-js/mdx'),
        import('remark-gfm')
    ]);
    parseFrontmatter = markdownRemark.parseFrontmatter;
    mdx = mdxJs.createProcessor({ remarkPlugins: [gfm.default, ...sitePlugins] });
}

const place = (err) => {
    const start = err.place?.start ?? err.place;
    return { line: err.line ?? start?.line ?? 1, column: err.column ?? start?.column ?? 1 };
};

// Problems the editor shows inline: YAML and required front matter, MDX
// syntax, and components used without an import.
function checkDraft(source, ext) {
    const problems = [];
    let parsed;
    try {
        parsed = parseFrontmatter(source, { frontmatter: 'empty-with-spaces' });
    } catch (err) {
        const line = (err.mark?.line ?? 0) + 1;
        problems.push({ line, column: (err.mark?.column ?? 0) + 1, message: `Front matter: ${err.reason ?? err.message}` });
        return problems;
    }
    for (const key of ['title', 'description', 'date']) {
        if (parsed.frontmatter[key] == null || parsed.frontmatter[key] === '') {
            problems.push({ line: 1, column: 1, message: `Front matter is missing \`${key}\`.` });
        }
    }
    if (parsed.frontmatter.date != null && Number.isNaN(new Date(parsed.frontmatter.date).valueOf())) {
        problems.push({ line: 1, column: 1, message: '`date` is not a valid date (use YYYY-MM-DD).' });
    }
    if (ext !== '.mdx') return problems;

    let tree;
    try {
        tree = mdx.parse(parsed.content);
    } catch (err) {
        problems.push({ ...place(err), message: err.reason ?? err.message });
        return problems;
    }
    // Names an MDX file defines: imports and `export const`
    const defined = new Set();
    const used = [];
    const visit = (node) => {
        if (node.type === 'mdxjsEsm') {
            for (const statement of node.data?.estree?.body ?? []) {
                if (statement.type === 'ImportDeclaration') {
                    statement.specifiers.forEach((s) => defined.add(s.local.name));
                } else if (statement.type === 'ExportNamedDeclaration' && statement.declaration) {
                    const declaration = statement.declaration;
                    if (declaration.id) defined.add(declaration.id.name);
                    declaration.declarations?.forEach((d) => d.id?.name && defined.add(d.id.name));
                }
            }
        }
        if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && /^[A-Z]/.test(node.name ?? '')) {
            used.push(node);
        }
        node.children?.forEach(visit);
    };
    visit(tree);
    for (const node of used) {
        const name = node.name.split('.')[0];
        if (!defined.has(name)) {
            problems.push({
                line: node.position?.start.line ?? 1,
                column: node.position?.start.column ?? 1,
                message: `<${node.name}> is used but never imported.`
            });
        }
    }
    return problems;
}

function draftTemplate(title) {
    // Keep in step with scripts/new-draft.mjs
    const today = new Date().toLocaleDateString('en-CA');
    return `---
title: ${JSON.stringify(title)}
description: "One-line summary shown on the blog index."
date: ${today}
# category: research
tags: []
---

Start writing here.
`;
}

export default function draftsEditor() {
    let root;
    let sitePlugins = [];

    return {
        name: 'drafts-editor',
        hooks: {
            'astro:config:setup': ({ command, config, updateConfig, logger }) => {
                if (command !== 'dev') return;
                // Astro 7 keeps remark plugins on the unified({...}) processor,
                // which .md and .mdx both read when they first render
                const plugins = config.markdown.processor?.options?.remarkPlugins;
                if (Array.isArray(plugins)) {
                    if (!plugins.includes(remarkSourceLines)) plugins.push(remarkSourceLines);
                } else {
                    logger.warn('markdown.processor is not unified({...}), so the editor can only sync scrolling roughly.');
                }
                updateConfig({
                    // Pre-bundle the editor's dependencies at startup; discovering
                    // them on first load would make Vite re-optimize mid-request.
                    vite: {
                        optimizeDeps: {
                            include: [
                                'codemirror',
                                '@codemirror/autocomplete',
                                '@codemirror/commands',
                                '@codemirror/lang-markdown',
                                '@codemirror/lang-yaml',
                                '@codemirror/language',
                                '@codemirror/lint',
                                '@codemirror/search',
                                '@codemirror/state',
                                '@codemirror/view',
                                '@lezer/highlight',
                                '@replit/codemirror-vim'
                            ]
                        }
                    }
                });
            },
            'astro:config:done': ({ config }) => {
                root = fileURLToPath(config.root);
                sitePlugins = (config.markdown.processor?.options?.remarkPlugins ?? [])
                    .filter((plugin) => plugin !== remarkSourceLines);
            },
            'astro:server:setup': async ({ server, logger }) => {
                await loadParsers(sitePlugins);
                const draftsDir = join(root, 'drafts');
                const componentsDir = join(root, 'src', 'components', 'blog');
                const publishedDir = join(root, 'src', 'content', 'blog');
                const assetsDir = join(root, 'public', 'assets', 'blog');

                const draftFile = (slug) => ['.mdx', '.md']
                    .map((ext) => join(draftsDir, slug + ext))
                    .find((file) => existsSync(file));

                // ---- Server-sent events ------------------------------------
                const clients = new Set();
                const broadcast = (event, data) => {
                    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
                    clients.forEach((res) => res.write(message));
                };
                const ping = setInterval(() => clients.forEach((res) => res.write(': ping\n\n')), 25000);
                ping.unref();

                // Astro reloads every page on any content or component change.
                // Tap that signal (and the error overlay payload) so the
                // editor refreshes its own preview instead.
                let lastError = null;
                let errorWaiters = [];
                let reloadTimer;
                const observe = (payload) => {
                    if (!payload || typeof payload !== 'object') return;
                    if (payload.type === 'full-reload') {
                        clearTimeout(reloadTimer);
                        reloadTimer = setTimeout(() => broadcast('reload', {}), 60);
                    } else if (payload.type === 'error') {
                        const err = payload.err ?? {};
                        lastError = {
                            time: Date.now(),
                            name: err.name,
                            title: err.title,
                            message: htmlToText(err.message),
                            hint: htmlToText(err.hint),
                            loc: err.loc
                        };
                        errorWaiters.forEach((wake) => wake());
                        errorWaiters = [];
                    }
                };
                // Astro sends a failed render's details over the HMR socket
                // 200ms after the response closes
                const errorSince = (since, ms) => new Promise((resolve) => {
                    if (lastError && lastError.time >= since) {
                        resolve(lastError);
                        return;
                    }
                    const timer = setTimeout(() => resolve(null), ms);
                    errorWaiters.push(() => {
                        clearTimeout(timer);
                        resolve(lastError);
                    });
                });
                for (const channel of new Set([server.ws, server.hot].filter(Boolean))) {
                    const send = channel.send.bind(channel);
                    channel.send = (...args) => {
                        observe(args[0]);
                        return send(...args);
                    };
                }

                // Drafts edited elsewhere (VS Code, git pull, Claude) reach open
                // editors as `file` events with the new content hash.
                let watcher = null;
                if (existsSync(draftsDir)) {
                    const fileTimers = new Map();
                    try {
                        watcher = watch(realpathSync(draftsDir), (_event, name) => {
                            if (!name || !/\.mdx?$/.test(name)) return;
                            clearTimeout(fileTimers.get(name));
                            fileTimers.set(name, setTimeout(() => {
                                const file = join(draftsDir, name);
                                const slug = name.replace(/\.mdx?$/, '');
                                const hash = existsSync(file) ? sha(readFileSync(file, 'utf8')) : null;
                                broadcast('file', { slug, hash });
                            }, 120));
                        });
                    } catch (err) {
                        logger.warn(`Not watching drafts/ for outside edits: ${err.message}`);
                    }
                }

                // ---- Preview -------------------------------------------------
                const origin = (req) => server.resolvedUrls?.local?.[0] ?? `http://${req.headers.host}/`;

                const sendErrorDocument = (res, error) => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="drafts-editor-error" content="${escapeAttr(JSON.stringify(error))}"></head><body></body></html>`);
                };

                const servePreview = async (req, res, slug) => {
                    const started = Date.now();
                    let upstream;
                    try {
                        upstream = await fetch(new URL(`/blog/${slug}/`, origin(req)), { headers: { accept: 'text/html' } });
                    } catch (err) {
                        sendErrorDocument(res, { message: `Could not render the preview: ${err.message}` });
                        return;
                    }
                    const html = await upstream.text();
                    if (!upstream.ok) {
                        const recent = upstream.status >= 500 ? await errorSince(started, 1000) : null;
                        const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
                        sendErrorDocument(res, recent ?? {
                            message: upstream.status === 404
                                ? `/blog/${slug}/ doesn't exist yet. Astro may still be loading the new file.`
                                : `${title ?? 'Render error'} (HTTP ${upstream.status}). The dev server terminal has the details.`
                        });
                        return;
                    }
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-store');
                    res.end(html
                        .replace(/<script type="module" src="\/@vite\/client"><\/script>/g, '')
                        .replace(/<script type="module" src="[^"]*\/dev-toolbar\/entrypoint\.js[^"]*"><\/script>/g, '')
                        .replace(/<script>window\.__astro_dev_toolbar__[\s\S]*?<\/script>/g, ''));
                };

                // ---- API ---------------------------------------------------------
                const listDrafts = () => readdirSync(draftsDir)
                    .filter((name) => /\.mdx?$/.test(name) && name !== 'README.md')
                    .map((name) => {
                        const file = join(draftsDir, name);
                        const ext = extname(name);
                        let title = name;
                        let date = null;
                        try {
                            const { frontmatter } = parseFrontmatter(readFileSync(file, 'utf8'));
                            title = frontmatter.title ?? name;
                            date = frontmatter.date ? new Date(frontmatter.date).toISOString().slice(0, 10) : null;
                        } catch {
                            // Broken front matter: list it by file name
                        }
                        return { slug: basename(name, ext), file: `drafts/${name}`, ext, title: String(title), date, mtime: statSync(file).mtimeMs };
                    })
                    .sort((a, b) => b.mtime - a.mtime);

                const api = async (req, res, path) => {
                    if (!existsSync(draftsDir)) {
                        sendJson(res, 503, { error: 'drafts/ is missing. Clone the private drafts repo into it first (see the README).' });
                        return;
                    }
                    const method = req.method ?? 'GET';
                    if (method !== 'GET' && !trusted(req)) {
                        sendJson(res, 403, { error: 'Missing editor header.' });
                        return;
                    }

                    if (path === 'events' && method === 'GET') {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream',
                            'Cache-Control': 'no-store',
                            Connection: 'keep-alive'
                        });
                        res.write(': connected\n\n');
                        clients.add(res);
                        req.on('close', () => clients.delete(res));
                        return;
                    }

                    if (path === 'components' && method === 'GET') {
                        const names = existsSync(componentsDir)
                            ? readdirSync(componentsDir).filter((n) => n.endsWith('.astro')).map((n) => n.slice(0, -6))
                            : [];
                        sendJson(res, 200, { components: names });
                        return;
                    }

                    if (path === 'drafts' && method === 'GET') {
                        sendJson(res, 200, { drafts: listDrafts() });
                        return;
                    }

                    if (path === 'drafts' && method === 'POST') {
                        const { slug, title, format } = JSON.parse((await readBody(req, 1e5)).toString('utf8'));
                        if (typeof slug !== 'string' || !SLUG.test(slug)) {
                            sendJson(res, 400, { error: 'Use a kebab-case slug, like my-post-title.' });
                            return;
                        }
                        for (const dir of [draftsDir, publishedDir]) {
                            for (const ext of ['.md', '.mdx']) {
                                if (existsSync(join(dir, slug + ext))) {
                                    sendJson(res, 409, { error: `${slug}${ext} already exists in ${dir === draftsDir ? 'drafts/' : 'src/content/blog/'}.` });
                                    return;
                                }
                            }
                        }
                        const ext = format === 'md' ? '.md' : '.mdx';
                        writeFileSync(join(draftsDir, slug + ext), draftTemplate(String(title || slug.replace(/-/g, ' '))));
                        sendJson(res, 201, { slug });
                        return;
                    }

                    const draftMatch = /^drafts\/([^/]+)$/.exec(path);
                    if (draftMatch) {
                        const slug = draftMatch[1];
                        const file = SLUG.test(slug) ? draftFile(slug) : null;
                        if (!file) {
                            sendJson(res, 404, { error: `No draft named ${slug}.` });
                            return;
                        }
                        const ext = extname(file);
                        if (method === 'GET') {
                            const content = readFileSync(file, 'utf8');
                            sendJson(res, 200, { slug, file: `drafts/${basename(file)}`, ext, content, hash: sha(content), problems: checkDraft(content, ext) });
                            return;
                        }
                        if (method === 'PUT') {
                            const { content, baseHash } = JSON.parse((await readBody(req, 8e6)).toString('utf8'));
                            if (typeof content !== 'string') {
                                sendJson(res, 400, { error: 'content must be a string.' });
                                return;
                            }
                            const current = readFileSync(file, 'utf8');
                            const currentHash = sha(current);
                            if (baseHash !== currentHash) {
                                sendJson(res, 409, { content: current, hash: currentHash });
                                return;
                            }
                            // The editor works in \n; keep the file's own line endings
                            const text = current.includes('\r\n') ? content.replace(/\r?\n/g, '\r\n') : content;
                            if (text !== current) writeFileSync(file, text);
                            sendJson(res, 200, { hash: sha(text), problems: checkDraft(content, ext) });
                            return;
                        }
                    }

                    const assetMatch = /^assets\/([^/]+)$/.exec(path);
                    if (assetMatch && method === 'POST') {
                        const slug = assetMatch[1];
                        if (!SLUG.test(slug)) {
                            sendJson(res, 400, { error: 'Bad slug.' });
                            return;
                        }
                        const requested = decodeURIComponent(String(req.headers['x-file-name'] ?? 'image.png'));
                        const ext = extname(requested).toLowerCase();
                        if (!IMAGE_TYPES.has(ext)) {
                            sendJson(res, 415, { error: `Only images can be pasted (${[...IMAGE_TYPES].join(', ')}).` });
                            return;
                        }
                        const stem = basename(requested, extname(requested)).toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'image';
                        const dir = join(assetsDir, slug);
                        mkdirSync(dir, { recursive: true });
                        let name = stem + ext;
                        for (let i = 2; existsSync(join(dir, name)); i++) name = `${stem}-${i}${ext}`;
                        writeFileSync(join(dir, name), await readBody(req, MAX_IMAGE_BYTES));
                        sendJson(res, 201, { url: `/assets/blog/${slug}/${name}` });
                        return;
                    }

                    sendJson(res, 404, { error: `No route for ${method} /edit/api/${path}.` });
                };

                server.middlewares.use(async (req, res, next) => {
                    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
                    if (pathname !== '/edit' && !pathname.startsWith('/edit/')) {
                        next();
                        return;
                    }
                    const rest = pathname.slice('/edit/'.length);
                    try {
                        if (rest.startsWith('api/')) {
                            await api(req, res, rest.slice(4));
                        } else if (rest === 'editor.css') {
                            sendFile(res, join(here, 'editor.css'), 'text/css; charset=utf-8');
                        } else if (rest.startsWith('preview/')) {
                            const slug = rest.slice('preview/'.length).replace(/\/$/, '');
                            if (!SLUG.test(slug)) {
                                sendJson(res, 400, { error: 'Bad slug.' });
                                return;
                            }
                            await servePreview(req, res, slug);
                        } else if (req.method === 'GET' && (rest === '' || SLUG.test(rest.replace(/\/$/, '')))) {
                            sendFile(res, join(here, 'editor.html'), 'text/html; charset=utf-8');
                        } else {
                            next();
                        }
                    } catch (err) {
                        logger.error(err.stack ?? String(err));
                        if (!res.headersSent) sendJson(res, err.status ?? 500, { error: err.message });
                    }
                });

                // Astro restarts the server when its config changes
                server.httpServer?.once('close', () => {
                    clearInterval(ping);
                    watcher?.close();
                    clients.forEach((res) => res.end());
                });

                server.httpServer?.once('listening', () => {
                    setTimeout(() => {
                        const base = server.resolvedUrls?.local?.[0] ?? 'http://localhost:4321/';
                        logger.info(`Drafts editor: ${new URL('/edit/', base)}`);
                    }, 0);
                });
            }
        }
    };
}
