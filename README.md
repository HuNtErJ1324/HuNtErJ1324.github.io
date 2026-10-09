# Personal Website

Welcome to the repository for my personal website, live at [justin-chae.org](https://justin-chae.org)! This website serves as a centralized platform to showcase my work, achievements, and ideas.

## Features

### 1. **Achievements & Papers**
Dedicated sections highlight my publications, projects, scholarships, and milestones.

### 2. **Violin**
A collection of my orchestral and solo performances.

### 3. **Blog**
Markdown/MDX posts rendered by Astro — see [Writing a blog post](#writing-a-blog-post).

## Tech

- **Framework**: [Astro 5](https://astro.build) static site with MDX; hand-written CSS and vanilla JS (`public/home.css`, `public/script.js`) with a Rosé Pine terminal aesthetic and vim-style keyboard navigation (`hjkl`, `gg`/`G`, `:` commands, `/` search, `?` for help)
- **Hosting**: GitHub Pages via GitHub Actions (`withastro/action`) with a custom domain (`CNAME`)

## Writing a blog post

1. Create `src/content/blog/some-slug.md` (or `.mdx`)
2. Add front matter:
   ```yaml
   ---
   title: "Post title"
   description: "One-line summary shown on the blog index."
   date: 2026-10-09
   category: research       # optional
   tags: ["some-tag"]       # optional, kebab-case
   ---
   ```
3. Write markdown below it, commit, and push to `main`.

The post appears at `justin-chae.org/blog/some-slug/`; the blog index, tag pages, and sitemap update automatically.

**Math:** wrap LaTeX in `$$…$$` (used for both inline and display). It renders with self-hosted MathJax — for example `$$E = mc^2$$` inline, or a `$$…$$` block on its own line for centered display math.

## Local preview

- `npm install` (Node 22+), then `npm run dev` for a hot-reloading dev server
- `npm run build && npm run preview` to check the production build in `dist/` (after deleting posts, build with `npx astro build --force` so Astro's content cache doesn't bring them back)
