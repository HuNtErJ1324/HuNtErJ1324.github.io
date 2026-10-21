# Personal Website

Welcome to the repository for my personal website, live at [justin-chae.org](https://justin-chae.org)! This website serves as a centralized platform to showcase my work, achievements, and ideas.

## Features

### 1. **Achievements & Papers**
Dedicated sections highlight my publications, projects, scholarships, and milestones.

### 2. **Violin**
A collection of my orchestral and solo performances.

### 3. **Blog**
Markdown/MDX posts rendered by Astro, with private drafts and self-hosted comments (no account needed; [`comments-server/`](comments-server/README.md)) — see [Writing a blog post](#writing-a-blog-post).

## Tech

- **Framework**: [Astro 7](https://astro.build) static site with MDX (rendered through the unified/remark pipeline for its plugins); hand-written CSS and vanilla JS (`public/home.css`, `public/script.js`) with a Rosé Pine terminal aesthetic and vim-style keyboard navigation (`hjkl`, `gg`/`G`, `:` commands, `/` search, `?` for help)
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
   tags: ["some-tag"]       # optional, must be kebab-case
   comments: false          # optional: only to hide the comments section
   ---
   ```
2. `npm run dev` and open `http://localhost:4321/blog/some-slug/`. Drafts show a red **draft** chip and are left out of production builds.
3. `npm run drafts:sync` backs drafts up to the private repo (pull, commit, push).
4. When it's ready: `npm run draft:publish -- some-slug`. This moves it to `src/content/blog/` and sets `date:` to today (`--keep-date` keeps it). Then commit and push this repo, and run `npm run drafts:sync`.

The post appears at `justin-chae.org/blog/some-slug/`; the blog index, tag pages, and sitemap update automatically.

### Sharing a draft before it's published

`npm run draft:share -- some-slug` gives a draft a private link, `justin-chae.org/drafts/<random-token>/`, for sending to a few readers. Then run `npm run drafts:sync` and redeploy the site: `gh workflow run deploy.yml`, **Actions → Deploy to GitHub Pages → Run workflow**, or any push to `main`. Do the same after each edit you want readers to see.

- The page looks like a post with a **draft** chip. It isn't on the blog index, tag pages, sitemap, or related posts, it's `noindex`, and it has no comments.
- The text never enters this public repo: the deploy pulls it from the private drafts repo. The tokens are masked in the public Actions logs.
- It's unlisted, not password-protected: anyone with the link can read it.
- The deploy builds from GitHub, so first commit and push anything the draft uses from this repo (`src/data/<slug>.json`, components, images). `draft:share` warns you about any of these that are missing.
- `npm run draft:share` lists shared drafts. `-- some-slug --rotate` issues a new link, and `-- some-slug --revoke` stops sharing. Both take effect on the next deploy. Publishing removes the token, and the draft link stops working.

**One-time setup** (so the deploy can read the private drafts repo):

1. `ssh-keygen -t ed25519 -C "site deploy: read blog-drafts" -f drafts_deploy_key` and press Enter twice at the passphrase prompts (Actions can't type a passphrase). Don't pass `-N ""`: PowerShell drops the empty argument and ssh-keygen fails with "Too many arguments".
2. In **blog-drafts → Settings → Deploy keys → Add deploy key**, paste `drafts_deploy_key.pub` and leave *Allow write access* unchecked.
3. In **this repo → Settings → Secrets and variables → Actions → New repository secret**, name it `DRAFTS_DEPLOY_KEY` and paste the contents of `drafts_deploy_key` (the private key). Then delete both local key files.

Without the secret, the site still builds; it just has no shared drafts.

**Comments:** every published post gets a comment thread from [Comentario](https://comentario.app), running on the home server behind a Cloudflare Tunnel. Readers comment with just a name (or none), or make an account; Claude Haiku approves, rejects, or holds comments from readers who aren't signed in, and anything held waits for you, with a phone notification. Setup and upkeep: [`comments-server/README.md`](comments-server/README.md).

**Math:** wrap LaTeX in `$$…$$` (used for both inline and display). It renders with self-hosted MathJax — for example `$$E = mc^2$$` inline, or a `$$…$$` block on its own line for centered display math. Write plain LaTeX: escapes such as `\;`, `\{`, and `\\` work as-is. MathJax only loads on posts that contain math.

**Embeds:** an `x.com/<user>/status/<id>` link on a line of its own becomes a click-to-load X post (links inside a sentence stay links).

## Local preview

- `npm install` (Node 22.12+), then `npm run dev` for a hot-reloading dev server
- `npm run build && npm run preview` to check the production build in `dist/` (after deleting posts, build with `npx astro build --force` so Astro's content cache doesn't bring them back)
