# AGENTS.md

This document serves as the primary source of truth for coding agents (AI) operating within this repository. It defines the build environment, code style, and architectural conventions for the personal portfolio website of Justin Yang Chae.

## 1. Project Overview & Environment

*   **Type:** Astro 5 static site (the site was ported from Jekyll — sources preserved under `_jekyll/` for reference).
*   **Hosting:** GitHub Pages via GitHub Actions (`.github/workflows/deploy.yml`, `withastro/action`). The `astro-port` branch carries the port; `main` may still hold the Jekyll site until the merge.
*   **Structure:**
    *   `src/pages/` — `index.astro` (home), `music.astro` (violin), `404.astro`, `blog/index.astro`, `blog/[...slug].astro` (post route), `sitemap.xml.js` (hand-rolled endpoint).
    *   `src/layouts/` — `Base.astro` (head/CSP/nav/statusline chrome), `Post.astro` (post header/related posts/MathJax).
    *   `src/content/blog/` — posts as `.md` or `.mdx` (MDX enabled: posts can import components).
    *   `src/plugins/remark-trace-directives.js` — maps `:::tool-call`-style containers onto the class conventions `public/script.js` expects.
    *   `public/` — `home.css`, `script.js`, `assets/` (fonts, favicons, PDFs, MathJax), `CNAME`, `robots.txt`, `.nojekyll`, and `music.html`/`blog.html` meta-refresh shims for the legacy URLs.
*   **URLs:** `/` , `/music/`, `/blog/`, `/blog/<slug>/` (slug = filename). The old `/music.html` and `/blog.html` redirect via shims in `public/`.

### Build & Run Commands

*   `npm install` (once; Node 20+)
*   `npm run dev` — dev server with HMR for local work
*   `npm run build` — static build into `dist/`
*   `npm run preview` — serve `dist/` for final checks
*   Deploy: push to `main` (Actions builds and deploys; no Jekyll involved).

### Blog posts

*   Files: `src/content/blog/<slug>.md` (or `.mdx`) with `title`, `description`, `date`, optional `category` front matter. Output URL: `/blog/<slug>/`. The blog index and `sitemap.xml` update automatically. No RSS feed — the user explicitly removed it; do not reintroduce feeds.
*   **Math:** write `$$…$$` in markdown; it passes through literally and renders client-side by the **self-hosted MathJax 3.2.2 SVG** bundle (`/assets/mathjax/tex-svg.js` + `/assets/mathjax-config.js`, delimiters `\(…\)` `\[…\]` `$$…$$`). Loaded by `Post.astro` only.
*   **Syntax highlighting:** Shiki with the `rose-pine` theme (config in `astro.config.mjs`).

## 2. Code Style & Conventions

### HTML (`.astro`)

*   **Indentation:** Use **Tabs**.
*   **Semantics:** deeply prioritized. Use `<nav>`, `<header>`, `<main>`, `<section>`, `<footer>` appropriately.
*   **Attributes:** double quotes; `alt` mandatory for images; `aria-label` for interactive elements without text labels.
*   **Performance:** lazy loading for below-the-fold images; explicit `width`/`height`; hero image keeps `fetchpriority="high"`. YouTube embeds must use the lite pattern (`.video-placeholder` + click-to-load in `script.js`).
*   **Security:** every page sets a `Content-Security-Policy` `<meta>` via `Base.astro` (`strict` for non-post pages; `post` adds `style-src 'unsafe-inline'` for MathJax/Shiki inline styles). External resources require updating the CSP. No inline `style=""` in authored markup; scripts load from `/script.js` (or `is:inline src=` files only).

### CSS (`public/home.css`)

*   **Theme:** Rosé Pine (main variant, https://rosepinetheme.com), terminal-flavored. Dark only, clean flat surfaces — NO CRT effects (scanlines/vignette/grain/glows/gridlines were deliberately removed). All colors via CSS variables in `:root`:
    *   Surfaces: `--bg` (#191724 base), `--bg-raised` (#1f1d2e surface), `--bg-inset` (#26233a overlay)
    *   Text: `--text` (#e0def4), `--subtle` (#908caa), `--muted` (#6e6a86); lines: `--border` (#403d52), `--border-bright` (#524f67)
    *   Accents: `--rose` (#ebbcba cursor/active/h2/focus), `--gold` (#f6c177 dates/labels/chips), `--iris` (#c4a7e7 links), `--foam` (#9ccfd8 mode block/keywords), `--pine` (#31748f quiet structure), `--love` (#eb6f92 errors/404)
    *   Stick to this mapping when adding components; do not reintroduce glows or textured backgrounds.
*   **Type pairing:** `--font-display` (Departure Mono) for headings/nav/statusline; `--font-body` (CommitMono Nerd Font) for copy. ALL fonts are self-hosted subset woff2 in `/assets/fonts/` (see its README) — **never load fonts from Google Fonts**: the site sits behind Cloudflare, whose "Cloudflare Fonts" feature rewrites Google Fonts links into inline `<style>` blocks that the strict CSP blocks (this broke headings in production once). Departure Mono has one weight — never apply `bold` to display type. CommitMono ships 400/700 only — use `font-weight: 700` for bold, never 600.
*   **Korean text:** `assets/fonts/NanumGothicCoding-name.woff2` contains ONLY the three glyphs 채정인. If you add any other Korean text, re-subset it with wider `--unicodes` (see `assets/fonts/README.md`).
*   **Units:** `rem` for font sizes/padding; kebab-case class names; multi-line rules.
*   **Motion:** every animation/transition must have a `prefers-reduced-motion: reduce` override.

### JavaScript (`public/script.js`)

*   **Indentation:** 4 spaces. Modern vanilla ES6+ (`const`/`let`, arrow functions, template literals, single quotes, semicolons required).
*   **Execution:** wrap logic in `document.addEventListener('DOMContentLoaded', ...)`.
*   **Progressive enhancement:** the site must remain fully readable with JS disabled (typed boot line falls back to static text, sections fall back to visible).
*   **Observers:** Use `IntersectionObserver` for scroll-based effects; throttle scroll handlers with `requestAnimationFrame`.

## 3. Architecture & Patterns

### Interactivity (public/script.js)
*   **Centralization:** All interactivity lives in `public/script.js` (shared by every Astro page). No inline JS in HTML.
*   Features: typed boot line, scroll reveal, active-nav highlighting (+`aria-current`), lite YouTube embeds, back-to-top, statusline scroll position + showcmd, and vim keyboard navigation (`j`/`k` scroll, `d`/`u` half page, `gg`/`G` top/bottom, `h`/`l` previous/next page, `?` help overlay, `Esc` close). The keydown handler must keep ignoring modifier combos and form fields, and the help overlay is built with `createElement` (no inline styles — CSP).
*   **Vim command mode (`:`):** pressing `:` opens an ex-style command line docked above the statusline (mode block shows `CMD`). Commands: `:about`/`:education`/`:papers`/`:projects`/`:achievements` scroll to sections (navigating to `/index.html#<section>` first when on another page), `:music`/`:blog`/`:home` navigate pages, `:email` copies the contact address to the clipboard, `:linkedin`/`:scholar`/`:github`/`:x`/`:twitter` open those profiles in a new tab (`noopener`), `:help` opens the key overlay, `:ls` lists sections, `:top`/`:bottom` (+ `:1`/`:$`) scroll, `:noh`/`:nohlsearch` clears search highlights, and `:q`/`:q!`/`:wq` are deliberate easter eggs. Supports `↑`/`↓` history, `Tab` prefix completion with candidate list, and `Esc` to close. Unknown commands echo `E492: not an editor command: <name>` in the `--love` color. Feedback is echoed into `#showcmd` (`.flash-msg`/`.err` classes) AND mirrored into a `.visually-hidden` `aria-live` region — keep both when editing.
*   **Vim search (`/`, `n`, `N`):** `/` opens the same docked command line in SEARCH mode; Enter runs a case-insensitive substring search over `<main>` text and wraps hits in `mark.search-hit` (`.current` = rose; `n`/`N` cycle and auto-open collapsed `details`/reveal hidden sections; empty Enter reuses the last pattern). Misses echo `E486: pattern not found`, `n` with no prior search echoes `E35`. Highlights clear via `:noh` or a new page load. Keep the `prefers-reduced-motion` (pulse) and print (transparent) overrides when editing.
*   **Blog trace blocks (Prime Intellect-style):** in a post, wrap code blocks or prose in directive containers — `:::tool-call` / `:::tool-output` / `:::annotation` / `:::reasoning` (starts collapsed) / `:::bibtex` (unnumbered) / `:::tldr` — and the `remarkTraceDirectives` plugin puts the class on the wrapper. On post pages `script.js` wraps these in numbered collapsible `details.trace-block` panels (steps run in document order across mixed code/prose) and every `pre` gets an overlay `[copy]` button (`.copied`/`.err` feedback states). Footnotes via `[^1]`/`[^1]: text` (GFM) render as a `~/footnotes` well. Plain code blocks stay unnumbered. Without JS everything degrades to normal code blocks/paragraphs.
*   **Blog post anatomy (general pattern):** optional `category: research|announcement|...` front matter renders a chip in the post header. Start with a `:::tldr` callout, then H2 sections (context → method → results → limits → related work), trace blocks for agent walkthroughs, a `## Citation` H2 with a `:::bibtex` block, and `[^n]` footnotes. The post layout auto-appends up to 3 **related posts** (`aside.related-posts`). `.mdx` posts may import components for charts/widgets (CSP applies — no inline scripts; load self-hosted files).
*   **Section flash:** command-mode jumps and `#hash` arrivals flash the target panel's border via the `.section-flash` class (animation restarts through reflow). Must keep its `prefers-reduced-motion: reduce` override.
*   **Abstract disclosure animation:** `details.abstract` animates open/close via `::details-content` + `interpolate-size: allow-keywords` inside an `@supports` block (progressive enhancement; unsupported browsers keep the instant toggle).
*   **Contact links:** intro icon buttons on the home page (Email, LinkedIn, Scholar, X) — mirror any changes in the JSON-LD `sameAs` array and the `:` command table.

### Assets
*   **Images:** WebP preferred with fallbacks (`<picture>`). Stored in `public/assets/`.
*   **PDFs:** stored in `public/assets/`.

## 4. Git & Version Control

*   **Commit Messages:** Present tense, imperative style (e.g., "Add scroll animation").
*   **Branching:** Direct commits to `main` are acceptable for this personal project, but complex features should use feature branches (the Astro port lives on `astro-port`).
*   **Never ignore `CNAME`:** it must stay committed (root copy and `public/CNAME`) or the custom domain breaks.
