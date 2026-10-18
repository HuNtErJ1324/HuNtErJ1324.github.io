// Drafts shared by link: a draft whose front matter has `share: "<token>"`
// (set by scripts/share-draft.mjs) is built into production at
// /drafts/<token>/, unlisted and noindex. src/content.config.ts uses this to
// pick the only draft files a production build loads, and the deploy workflow
// uses it to mask the tokens in its public logs.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

// Lowercase letters and digits, so a link that gets retyped or lowercased still works
export const shareTokenPattern = /^[a-z0-9]{16,64}$/;

// The `share:` value in a draft's front matter, or null. The content schema
// validates it; this only decides which drafts a production build loads.
export function shareToken(source) {
    const frontMatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const line = frontMatter?.[1].match(/^share:[ \t]*(['"]?)([^\s'"#]+)\1[ \t]*(?:#.*)?$/m);
    return line ? line[2] : null;
}

// Every shared draft under `dir` (matching the drafts collection's glob:
// .md/.mdx, no README.md, no dot-directories) as { file, slug, token }, with
// `file` relative to `dir` and slash-separated like a glob pattern.
export function sharedDrafts(dir = 'drafts') {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { recursive: true })
        .map((path) => path.split(sep).join('/'))
        .filter((file) => /\.mdx?$/.test(file)
            && !/(^|\/)README\.md$/.test(file)
            && !file.split('/').some((part) => part.startsWith('.')))
        .map((file) => ({ file, slug: file.replace(/\.mdx?$/, ''), token: shareToken(readFileSync(join(dir, file), 'utf8')) }))
        .filter(({ token }) => token);
}
