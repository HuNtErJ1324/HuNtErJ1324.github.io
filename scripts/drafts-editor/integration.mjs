// Browser editor for an Astro site's drafts, under `astro dev` only: run the
// dev server, then open http://localhost:4321/edit/. It writes straight to
// drafts/<slug>.mdx and shows the real rendered post beside the source.
//
//   GET  /edit/ and /edit/<slug>     the editor page. It is plain HTML without
//                                    the Vite client, so the full-page reloads
//                                    Astro sends on every content change never
//                                    reset it.
//   GET  /edit/preview/<slug>/       the `preview` page (/blog/<slug>/) as
//                                    Astro renders it, minus the Vite client
//                                    and dev toolbar, so the editor decides
//                                    when the preview reloads (it
//                                    double-buffers two iframes).
//   GET  /edit/api/events            server-sent events: `reload` whenever
//                                    Astro reloads pages, `file` when a draft
//                                    changes on disk.
//   GET  /edit/api/drafts            the drafts, newest edit first
//   POST /edit/api/drafts            create a draft from `template`
//   GET  /edit/api/drafts/<slug>     one draft's source and hash
//   PUT  /edit/api/drafts/<slug>     save; 409 if the file changed on disk
//                                    since the editor last saw it
//   GET  /edit/api/components        names in the `components` folder
//   POST /edit/api/assets/<slug>     save a pasted image under `assets`
//
// The client lives in client.js (served and bundled by Vite) and editor.css.
// Every path above moves with the `base` option. It also defines
// import.meta.env.SHOW_DRAFTS ('true' under astro dev, else 'false').
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, statSync, watch, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { remarkSourceLines } from './remark-source-lines.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const IMAGE_TYPES = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.svg']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const sha = (text) => createHash('sha1').update(text).digest('hex');
const posix = (path) => path.replace(/\\/g, '/');
const fill = (pattern, values) => pattern.replace(/\[(\w+)\]/g, (match, key) => values[key] ?? match);
const inside = (parent, child) => {
    const path = relative(parent, child);
    return !path.startsWith('..') && !isAbsolute(path);
};

const sendJson = (res, status, body) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
};

const sendText = (res, text, type) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    res.end(text);
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
function checkDraft(source, ext, required) {
    const problems = [];
    let parsed;
    try {
        parsed = parseFrontmatter(source, { frontmatter: 'empty-with-spaces' });
    } catch (err) {
        const line = (err.mark?.line ?? 0) + 1;
        problems.push({ line, column: (err.mark?.column ?? 0) + 1, message: `Front matter: ${err.reason ?? err.message}` });
        return problems;
    }
    for (const key of required) {
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

const defaultTemplate = ({ title, date }) => `---
title: ${JSON.stringify(title)}
description: "One-line summary."
date: ${date}
---

Start writing here.
`;

// Options (all optional; paths are relative to the project root):
//   base         where the editor is served                    '/edit/'
//   drafts       folder of .md/.mdx drafts                     'drafts'
//   preview      the page that renders a draft under astro dev '/blog/[slug]/'
//   published    folders whose slugs a new draft can't reuse   ['src/content/blog']
//   components   folder of .astro components for the insert
//                menu and autocomplete, or false               'src/components'
//   componentImport  import path written for a component       '@/components/[name].astro'
//   assets       folder pasted images are saved to (under
//                public/), or false to turn uploads off        'public/assets/blog/[slug]'
//   required     front matter keys a draft must have           ['title']
//   template     ({ title, slug, date, format }) => source of a new draft
//   snippets     extra insert-menu items:
//                { group, label, template, imports?, block? }, where template
//                uses ${field} placeholders (Tab moves between them)
//   css          stylesheets (paths) loaded after editor.css, for fonts or a theme
export default function draftsEditor(options = {}) {
    const settings = {
        base: `/${String(options.base ?? '/edit/').replace(/^\/+|\/+$/g, '')}/`,
        drafts: options.drafts ?? 'drafts',
        preview: options.preview ?? '/blog/[slug]/',
        published: [options.published ?? ['src/content/blog']].flat(),
        components: options.components ?? 'src/components',
        componentImport: options.componentImport ?? '@/components/[name].astro',
        assets: options.assets ?? 'public/assets/blog/[slug]',
        required: options.required ?? ['title'],
        template: options.template ?? defaultTemplate,
        snippets: options.snippets ?? [],
        css: options.css ?? []
    };
    const base = settings.base;
    let root;
    let publicDir;
    let sitePlugins = [];

    return {
        name: 'drafts-editor',
        hooks: {
            'astro:config:setup': ({ command, config, updateConfig, logger }) => {
                // For the site to load drafts under `astro dev` only. Not
                // import.meta.env.DEV, which is just NODE_ENV !== 'production':
                // `NODE_ENV=development astro build` would ship every draft.
                updateConfig({
                    vite: { define: { 'import.meta.env.SHOW_DRAFTS': JSON.stringify(command === 'dev' ? 'true' : 'false') } }
                });
                if (command !== 'dev') return;
                // Astro 7 keeps remark plugins on the unified({...}) processor,
                // which .md and .mdx both read when they first render
                const plugins = config.markdown.processor?.options?.remarkPlugins;
                if (Array.isArray(plugins)) {
                    if (!plugins.includes(remarkSourceLines)) plugins.push(remarkSourceLines);
                } else {
                    logger.warn('markdown.processor is not unified({...}), so the editor can only sync scrolling roughly.');
                }
                const projectRoot = fileURLToPath(config.root);
                updateConfig({
                    vite: {
                        // Pre-bundle the editor's dependencies at startup; discovering
                        // them on first load would make Vite re-optimize mid-request.
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
                        },
                        // A linked install lives outside the project, where Vite
                        // won't serve client.js unless allowed
                        ...(inside(projectRoot, here) ? {} : { server: { fs: { allow: [projectRoot, here] } } })
                    }
                });
            },
            'astro:config:done': ({ config }) => {
                root = fileURLToPath(config.root);
                publicDir = fileURLToPath(config.publicDir);
                sitePlugins = (config.markdown.processor?.options?.remarkPlugins ?? [])
                    .filter((plugin) => plugin !== remarkSourceLines);
            },
            'astro:server:setup': async ({ server, logger }) => {
                await loadParsers(sitePlugins);
                const draftsDir = resolve(root, settings.drafts);
                const draftsLabel = `${posix(relative(root, draftsDir))}/`;
                const componentsDir = settings.components ? resolve(root, settings.components) : null;
                const publishedDirs = settings.published.map((dir) => resolve(root, dir));
                const assetsDir = (slug) => resolve(root, fill(settings.assets, { slug }));
                if (settings.assets && !inside(publicDir, assetsDir('x'))) {
                    logger.warn(`assets (${settings.assets}) is outside public/, so pasted images would not be served. Uploads are off.`);
                    settings.assets = false;
                }
                const stylesheets = settings.css.map((file) => resolve(root, file));

                // The editor page: config for the client, then the client itself,
                // served by Vite from wherever this package is installed
                const clientPath = inside(root, here)
                    ? `/${posix(relative(root, here))}/client.js`
                    : `/@fs/${posix(here).replace(/^\//, '')}/client.js`;
                const clientConfig = {
                    base,
                    preview: settings.preview,
                    componentImport: settings.componentImport,
                    uploads: Boolean(settings.assets),
                    snippets: settings.snippets
                };
                const editorPage = () => readFileSync(join(here, 'editor.html'), 'utf8').replace('</head>', [
                    `\t<link rel="stylesheet" href="${base}editor.css">`,
                    ...stylesheets.map((_file, i) => `\t<link rel="stylesheet" href="${base}theme-${i}.css">`),
                    `\t<script type="application/json" id="drafts-editor-config">${JSON.stringify(clientConfig).replace(/</g, '\\u003c')}</script>`,
                    `\t<script type="module" src="${clientPath}"></script>`,
                    '</head>'
                ].join('\n'));

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

                // Drafts edited elsewhere (another editor, git pull, an agent)
                // reach open editors as `file` events with the new content hash.
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
                        logger.warn(`Not watching ${draftsLabel} for outside edits: ${err.message}`);
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
                    const page = fill(settings.preview, { slug });
                    let upstream;
                    try {
                        upstream = await fetch(new URL(page, origin(req)), { headers: { accept: 'text/html' } });
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
                                ? `${page} doesn't exist yet. Astro may still be loading the new file.`
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
                        return { slug: basename(name, ext), file: draftsLabel + name, ext, title: String(title), date, mtime: statSync(file).mtimeMs };
                    })
                    .sort((a, b) => b.mtime - a.mtime);

                const api = async (req, res, path) => {
                    if (!existsSync(draftsDir)) {
                        sendJson(res, 503, { error: `${draftsLabel} doesn't exist. Create it, or point the drafts option at your drafts folder.` });
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
                        const names = componentsDir && existsSync(componentsDir)
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
                        for (const dir of [draftsDir, ...publishedDirs]) {
                            for (const ext of ['.md', '.mdx']) {
                                if (existsSync(join(dir, slug + ext))) {
                                    sendJson(res, 409, { error: `${slug}${ext} already exists in ${posix(relative(root, dir))}/.` });
                                    return;
                                }
                            }
                        }
                        const ext = format === 'md' ? '.md' : '.mdx';
                        // Local calendar date (en-CA formats as YYYY-MM-DD), not UTC
                        const source = settings.template({
                            title: String(title || slug.replace(/-/g, ' ')),
                            slug,
                            date: new Date().toLocaleDateString('en-CA'),
                            format: ext.slice(1)
                        });
                        writeFileSync(join(draftsDir, slug + ext), source);
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
                            sendJson(res, 200, { slug, file: draftsLabel + basename(file), ext, content, hash: sha(content), problems: checkDraft(content, ext, settings.required) });
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
                            sendJson(res, 200, { hash: sha(text), problems: checkDraft(content, ext, settings.required) });
                            return;
                        }
                    }

                    const assetMatch = /^assets\/([^/]+)$/.exec(path);
                    if (assetMatch && method === 'POST') {
                        const slug = assetMatch[1];
                        if (!settings.assets) {
                            sendJson(res, 404, { error: 'Image uploads are off (the assets option).' });
                            return;
                        }
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
                        const dir = assetsDir(slug);
                        mkdirSync(dir, { recursive: true });
                        let name = stem + ext;
                        for (let i = 2; existsSync(join(dir, name)); i++) name = `${stem}-${i}${ext}`;
                        writeFileSync(join(dir, name), await readBody(req, MAX_IMAGE_BYTES));
                        sendJson(res, 201, {
                            url: `/${posix(relative(publicDir, join(dir, name)))}`,
                            dir: `${posix(relative(root, dir))}/`
                        });
                        return;
                    }

                    sendJson(res, 404, { error: `No route for ${method} ${base}api/${path}.` });
                };

                server.middlewares.use(async (req, res, next) => {
                    const { pathname } = new URL(req.url ?? '/', 'http://localhost');
                    if (pathname !== base.slice(0, -1) && !pathname.startsWith(base)) {
                        next();
                        return;
                    }
                    const rest = pathname.slice(base.length);
                    try {
                        const theme = /^theme-(\d+)\.css$/.exec(rest);
                        if (rest.startsWith('api/')) {
                            await api(req, res, rest.slice(4));
                        } else if (rest === 'editor.css') {
                            sendText(res, readFileSync(join(here, 'editor.css')), 'text/css; charset=utf-8');
                        } else if (theme && stylesheets[theme[1]]) {
                            sendText(res, readFileSync(stylesheets[theme[1]]), 'text/css; charset=utf-8');
                        } else if (rest.startsWith('preview/')) {
                            const slug = rest.slice('preview/'.length).replace(/\/$/, '');
                            if (!SLUG.test(slug)) {
                                sendJson(res, 400, { error: 'Bad slug.' });
                                return;
                            }
                            await servePreview(req, res, slug);
                        } else if (req.method === 'GET' && (rest === '' || SLUG.test(rest.replace(/\/$/, '')))) {
                            sendText(res, editorPage(), 'text/html; charset=utf-8');
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
                        const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:4321/';
                        logger.info(`Drafts editor: ${new URL(base, url)}`);
                    }, 0);
                });
            }
        }
    };
}
