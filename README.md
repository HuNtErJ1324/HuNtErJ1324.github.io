# Personal Website

Welcome to the repository for my personal website, live at [justin-chae.org](https://justin-chae.org)! This website serves as a centralized platform to showcase my work, achievements, and ideas.

## Features

### 1. **Achievements & Papers**
Dedicated sections highlight my publications, projects, scholarships, and milestones.

### 2. **Violin**
A collection of my orchestral and solo performances.

### 3. **Blog**
Markdown/MDX posts rendered by Astro, with private drafts and [giscus](https://giscus.app) comments (GitHub Discussions) — see [Writing a blog post](#writing-a-blog-post).

## Tech

- **Framework**: [Astro 5](https://astro.build) static site with MDX; hand-written CSS and vanilla JS (`public/home.css`, `public/script.js`) with a Rosé Pine terminal aesthetic and vim-style keyboard navigation (`hjkl`, `gg`/`G`, `:` commands, `/` search, `?` for help)
- **Hosting**: GitHub Pages via GitHub Actions (`withastro/action`) with a custom domain (`CNAME`)

## Writing a blog post

Drafts live in `drafts/`, a git-ignored clone of the **private** repo
[`blog-drafts`](https://github.com/HuNtErJ1324/blog-drafts), so unpublished text never reaches this public repo.
On a new machine, set it up once with `git clone git@github.com:HuNtErJ1324/blog-drafts.git drafts`.

1. `npm run draft:new -- some-slug "Post Title"` (add `--mdx` for MDX). This creates `drafts/some-slug.md` with starter front matter. All supported fields:
   ```yaml
   ---
   title: "Post Title"
   description: "One-line summary shown on the blog index."
   date: 2026-10-09
   category: research       # optional
   tags: ["some-tag"]       # optional, kebab-case
   comments: false          # optional: only to hide the comments section
   ---
   ```
2. `npm run dev` and open `http://localhost:4321/blog/some-slug/`. Drafts show a red **draft** chip and are left out of production builds.
3. `npm run drafts:sync` backs drafts up to the private repo (pull, commit, push).
4. When it's ready: `npm run draft:publish -- some-slug`. This moves it to `src/content/blog/` and sets `date:` to today (`--keep-date` keeps it). Then commit and push this repo, and run `npm run drafts:sync`.

The post appears at `justin-chae.org/blog/some-slug/`; the blog index, tag pages, and sitemap update automatically.

**Comments:** every published post gets a giscus comment thread (stored in this repo's GitHub Discussions, *Announcements* category). Readers sign in with GitHub to comment, reply, and upvote with 👍. Moderate (hide, delete, lock) on GitHub.

**Math:** wrap LaTeX in `$$…$$` (used for both inline and display). It renders with self-hosted MathJax — for example `$$E = mc^2$$` inline, or a `$$…$$` block on its own line for centered display math.

## Local preview

- `npm install` (Node 22+), then `npm run dev` for a hot-reloading dev server
- `npm run build && npm run preview` to check the production build in `dist/` (after deleting posts, build with `npx astro build --force` so Astro's content cache doesn't bring them back)
