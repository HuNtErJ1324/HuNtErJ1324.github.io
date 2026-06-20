# Personal Website

Welcome to the repository for my personal website, live at [justin-chae.org](https://justin-chae.org)! This website serves as a centralized platform to showcase my work, achievements, and ideas.

## Features

### 1. **Achievements & Papers**
Dedicated sections highlight my publications, projects, scholarships, and milestones.

### 2. **Violin**
A collection of my orchestral and solo performances.

### 3. **Blog**
A markdown blog built with Jekyll and rendered automatically by GitHub Pages — see [Writing a blog post](#writing-a-blog-post).

## Tech

- **Frontend**: Hand-written HTML/CSS/vanilla JS with a Rosé Pine terminal aesthetic and vim-style keyboard navigation (`hjkl`, `gg`/`G`, `?` for help)
- **Blog**: Jekyll (built natively by GitHub Pages — no local tooling required)
- **Hosting**: GitHub Pages with a custom domain (`CNAME`)

`index.html` and `music.html` are plain static files you can open directly in a browser. The blog (`blog.html`, `_posts/`, `_layouts/`) is rendered by Jekyll when GitHub Pages builds the site on push.

## Writing a blog post

1. Create `_posts/YYYY-MM-DD-some-slug.md`
2. Add front matter:
   ```yaml
   ---
   title: "Post title"
   description: "One-line summary shown on the blog index."
   ---
   ```
3. Write markdown below it, commit, and push to `main`.

The post appears at `justin-chae.org/blog/some-slug/`, and the blog index and sitemap update automatically.

**Math:** wrap LaTeX in `$$…$$` (used for both inline and display). It renders with self-hosted MathJax — for example `$$E = mc^2$$` inline, or a `$$…$$` block on its own line for centered display math.

## Local preview

- Static pages: just open `index.html` / `music.html` in a browser, or run any static server.
- Full site including the blog (optional, requires Ruby): `bundle install && bundle exec jekyll serve`, then visit `http://localhost:4000`.
