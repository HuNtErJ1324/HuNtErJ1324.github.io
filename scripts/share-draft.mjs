// Share a draft by link before it's published. Adds a random `share:` token to
// its front matter; the next deploy builds it at
// https://justin-chae.org/drafts/<token>/ — unlisted (no blog index, tag page,
// sitemap, or related-posts entry), noindex, and without comments. The text
// stays in the private drafts repo, which the deploy workflow checks out with
// the DRAFTS_DEPLOY_KEY secret. Anyone with the link can read it.
//
//   npm run draft:share                       # list shared drafts and their links
//   npm run draft:share -- <slug>             # share it (or print its link)
//   npm run draft:share -- <slug> --rotate    # new link; the old one stops working
//   npm run draft:share -- <slug> --revoke    # stop sharing
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sharedDrafts, shareToken } from './shared-drafts.mjs';

const link = (token) => `https://justin-chae.org/drafts/${token}/`;

const args = process.argv.slice(2);
const rotate = args.includes('--rotate');
const revoke = args.includes('--revoke');
const [slug] = args.filter((arg) => arg !== '--rotate' && arg !== '--revoke');

const deploySteps = [
    'Takes effect on the next deploy:',
    '  npm run drafts:sync          # pushes the draft to the private repo',
    '  gh workflow run deploy.yml   # or GitHub → Actions → Deploy to GitHub Pages → Run workflow (a push to main works too)'
];

if (!slug) {
    if (rotate || revoke) {
        console.error('usage: npm run draft:share -- <slug> [--rotate | --revoke]');
        process.exit(1);
    }
    const shared = sharedDrafts();
    if (shared.length === 0) {
        console.log('No drafts are shared. Share one with: npm run draft:share -- <slug>');
    }
    shared.forEach(({ slug: name, token }) => console.log(`${name}  ${link(token)}`));
    process.exit(0);
}

const ext = ['md', 'mdx'].find((e) => existsSync(join('drafts', `${slug}.${e}`)));
if (!ext) {
    console.error(`No draft found at drafts/${slug}.md or drafts/${slug}.mdx`);
    process.exit(1);
}

const file = join('drafts', `${slug}.${ext}`);
const source = readFileSync(file, 'utf8');
const frontMatter = source.match(/^---\r?\n[\s\S]*?\r?\n---/);
if (!frontMatter) {
    console.error(`${file} has no front matter.`);
    process.exit(1);
}
const current = shareToken(source);
const write = (updated) => writeFileSync(file, updated + source.slice(frontMatter[0].length));

if (revoke) {
    if (!/^share:/m.test(frontMatter[0])) {
        console.log(`${slug} isn't shared.`);
        process.exit(0);
    }
    write(frontMatter[0].replace(/^share:.*\r?\n/m, ''));
    console.log(`Stopped sharing ${slug}; its link stops working after the next deploy.`);
    deploySteps.forEach((step) => console.log(step));
    process.exit(0);
}

if (current && !rotate) {
    console.log(`${slug} is shared at ${link(current)}`);
    console.log(`(--rotate gives it a new link, --revoke stops sharing it)`);
    process.exit(0);
}

const token = randomBytes(10).toString('hex');
const line = `share: "${token}"`;
write(/^share:.*$/m.test(frontMatter[0])
    ? frontMatter[0].replace(/^share:.*$/m, line)
    : frontMatter[0].replace(/(\r?\n)---$/, `$1${line}$1---`));

console.log(`${current ? 'New link for' : 'Shared'} ${slug}: ${link(token)}`);
if (current) {
    console.log(`The old link (${link(current)}) stops working after the next deploy.`);
}
console.log(`Local preview: npm run dev, then http://localhost:4321/drafts/${token}/`);
deploySteps.forEach((step) => console.log(step));
console.log('Anyone with the link can read the draft: it is unlisted, not password-protected.');
