---
name: Drafts editor
description: A browser editor for an Astro site's drafts, with the real rendered page beside the source.
repo: https://github.com/HuNtErJ1324/astro-drafts-editor
stack: [astro, codemirror, javascript]
image: /assets/tools/drafts-editor
imageAlt: "The drafts editor: Markdown source with vim keys on the left, the rendered blog post on the right."
date: 2026-10-23
---

I write every post on this blog in it. It's an Astro integration that adds an editor at `/edit/` to the dev server: the source on one side, and on the other the page the site actually renders for that draft, with its own layout, components and CSS, updating as you type.

- Saves to the file as you type, and asks before overwriting a file that changed on disk
- Scroll sync both ways; double-click the preview to jump to the source line
- Flags broken front matter, MDX errors and missing imports inline
- Vim keys, footnote and image-paste helpers, and an insert menu for your own components
- Only runs under `astro dev`, so nothing ships with the site

Install it with `npm install -D github:HuNtErJ1324/astro-drafts-editor`. The README covers rendering drafts under `astro dev` only.
