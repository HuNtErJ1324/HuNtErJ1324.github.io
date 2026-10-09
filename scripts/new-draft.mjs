// Create a blog draft in drafts/ (a git-ignored clone of the PRIVATE
// blog-drafts repo). Drafts only show up under `npm run dev`.
//
//   npm run draft:new -- <slug> [Title words...] [--mdx]
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const mdx = args.includes('--mdx');
const [slug, ...titleWords] = args.filter((arg) => arg !== '--mdx');

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    console.error('usage: npm run draft:new -- <kebab-case-slug> [Title words...] [--mdx]');
    process.exit(1);
}

for (const dir of ['drafts', 'src/content/blog']) {
    for (const ext of ['md', 'mdx']) {
        if (existsSync(join(dir, `${slug}.${ext}`))) {
            console.error(`${dir}/${slug}.${ext} already exists.`);
            process.exit(1);
        }
    }
}

if (!existsSync('drafts')) {
    console.error('drafts/ is missing. Clone the private drafts repo first:');
    console.error('  git clone git@github.com:HuNtErJ1324/blog-drafts.git drafts');
    process.exit(1);
}

const title = titleWords.join(' ') || slug.replace(/-/g, ' ');
// Local calendar date (en-CA formats as YYYY-MM-DD), not UTC
const today = new Date().toLocaleDateString('en-CA');
const file = join('drafts', `${slug}.${mdx ? 'mdx' : 'md'}`);

writeFileSync(file, `---
title: ${JSON.stringify(title)}
description: "One-line summary shown on the blog index."
date: ${today}
# category: research
tags: []
---

Start writing here.
`);

console.log(`Created ${file}`);
console.log(`Preview: npm run dev, then open http://localhost:4321/blog/${slug}/`);
