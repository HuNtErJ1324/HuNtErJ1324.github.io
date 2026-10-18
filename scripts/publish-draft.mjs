// Move a draft from drafts/ into src/content/blog/ so the next push publishes
// it. The front matter date is set to today unless --keep-date is passed, and
// a `share:` token (npm run draft:share) is dropped: it has no use in the public repo.
//
//   npm run draft:publish -- <slug> [--keep-date]
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const keepDate = args.includes('--keep-date');
const [slug] = args.filter((arg) => arg !== '--keep-date');

if (!slug) {
    console.error('usage: npm run draft:publish -- <slug> [--keep-date]');
    process.exit(1);
}

const ext = ['md', 'mdx'].find((e) => existsSync(join('drafts', `${slug}.${e}`)));
if (!ext) {
    console.error(`No draft found at drafts/${slug}.md or drafts/${slug}.mdx`);
    process.exit(1);
}

// A published post with either extension owns this slug
const clash = ['md', 'mdx'].map((e) => join('src/content/blog', `${slug}.${e}`)).find((path) => existsSync(path));
if (clash) {
    console.error(`${clash} already exists; refusing to overwrite it.`);
    process.exit(1);
}

const from = join('drafts', `${slug}.${ext}`);
const to = join('src/content/blog', `${slug}.${ext}`);
mkdirSync(dirname(to), { recursive: true });
renameSync(from, to);

const source = readFileSync(to, 'utf8');
const frontMatter = source.match(/^---\r?\n[\s\S]*?\r?\n---/);
let updated = frontMatter?.[0] ?? '';
if (!keepDate) {
    // Local calendar date (en-CA formats as YYYY-MM-DD), not UTC
    const today = new Date().toLocaleDateString('en-CA');
    if (/^date:/m.test(updated)) {
        updated = updated.replace(/^date:.*$/m, `date: ${today}`);
    } else {
        console.warn('No date: line found in the front matter; leaving it as is.');
    }
}
const shared = /^share:/m.test(updated);
updated = updated.replace(/^share:.*\r?\n/m, '');
if (frontMatter) {
    writeFileSync(to, updated + source.slice(frontMatter[0].length));
}

console.log(`Published ${from} -> ${to}`);
if (shared) {
    console.log('Removed its share: token; the shared /drafts/ link stops working once drafts:sync records the move and the site redeploys.');
}
if (ext === 'mdx') {
    console.log('MDX: check any relative imports, since the file moved directories.');
}
console.log('Next:');
console.log(`  git add ${to} && git commit -m "Publish ${slug}" && git push   # deploys the post`);
console.log('  npm run drafts:sync                                              # records the move in the drafts repo');
