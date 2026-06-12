# AGENTS.md

This document serves as the primary source of truth for coding agents (AI) operating within this repository. It defines the build environment, code style, and architectural conventions for the personal portfolio website of Justin Yang Chae.

## 1. Project Overview & Environment

*   **Type:** Static Website (HTML5, CSS3, Vanilla JavaScript) + Jekyll blog.
*   **Hosting:** GitHub Pages (builds the site with Jekyll automatically on push to `main`).
*   **Structure:**
    *   Root: plain static pages (`index.html`, `music.html`) and assets (`script.js`, `home.css`).
    *   Jekyll-rendered: `blog.html` (blog index, output at `/blog/`), `404.html`, `sitemap.xml`, `_posts/`, `_layouts/`, `_config.yml`.
    *   `/assets`: Images, favicons, PDFs.
*   **IMPORTANT:** `index.html` and `music.html` intentionally have **no front matter** so they are copied through verbatim and stay directly openable in a browser. Do not add front matter to them. Blog/404/sitemap pages DO have front matter and are processed by Jekyll.

### Build & Run Commands

*   **Static pages:** Open `index.html` in any modern web browser, or serve the root with any static HTTP server.
*   **Blog pages:** Rendered only by Jekyll. Local preview (optional, needs Ruby): `bundle install && bundle exec jekyll serve`. There is no Ruby on the primary dev machine — GitHub Pages performs the real build, so validate Liquid/YAML changes by careful review.
*   **Testing:** Manual visual verification. No unit tests exist.

### Blog posts

*   Files: `_posts/YYYY-MM-DD-slug.md` with `title` and `description` front matter (layout defaults to `post` via `_config.yml`).
*   Output URL: `/blog/<slug>/`. The blog index and `sitemap.xml` (hand-rolled Liquid template) update automatically. No RSS feed — the user explicitly removed it; do not reintroduce `jekyll-feed` or feed links.
*   **Math:** write LaTeX in posts with kramdown's `$$…$$` (both inline and display — single `$` is NOT math in kramdown). kramdown 2.4 (built-in `mathjax` engine, no extra gem) converts these to `\(…\)` / `\[…\]` in the HTML. Rendering is **self-hosted MathJax 3.2.2 SVG** (`/assets/mathjax/tex-svg.js`, ~2MB, fonts embedded — no font downloads, no CDN) configured by `/assets/mathjax-config.js` (delimiters `\(…\)`/`\[…\]`, code/`.highlight` skipped). Both are loaded in `_layouts/default.html` only when `page.layout == 'post'`. MathJax injects a `<style id="MJX-SVG-styles">`, so the blog layout CSP carries `style-src 'unsafe-inline'` (index.html/music.html stay stricter). When hand-authoring a post shim under `/blog/<slug>/` for local preview, replicate kramdown's `\(…\)`/`\[…\]` output and include the same CSP meta + MathJax scripts.
*   Only [GitHub Pages whitelisted plugins](https://pages.github.com/versions/) may be added to `_config.yml`.

## 2. Code Style & Conventions

### HTML (`.html`)

*   **Indentation:** Use **Tabs**.
*   **Semantics:** deeply prioritized. Use `<nav>`, `<header>`, `<main>`, `<section>`, `<footer>` appropriately.
*   **Attributes:** double quotes; `alt` mandatory for images; `aria-label` for interactive elements without text labels.
*   **Performance:**
    *   Lazy loading (`loading="lazy"`) for below-the-fold images; explicit `width`/`height` to avoid layout shift.
    *   **YouTube Embeds:** Do NOT use raw `<iframe>`s. Use the "Lite" embed pattern in `script.js` (placeholder image + click listener, loads `youtube-nocookie.com`).
*   **Security:** every page carries a `Content-Security-Policy` `<meta>` tag (GitHub Pages cannot send custom headers — a `_headers` file does nothing here). If you add an external resource, update the CSP on `index.html`, `music.html`, and `_layouts/default.html`. No inline `style=""` attributes and no inline `<script>` (other than the JSON-LD data block) — the CSP forbids them.

### CSS (`home.css`)

*   **Theme:** Rosé Pine (main variant, https://rosepinetheme.com), terminal-flavored. Dark only, clean flat surfaces — NO CRT effects (scanlines/vignette/grain/glows/gridlines were deliberately removed). All colors via CSS variables in `:root`:
    *   Surfaces: `--bg` (#191724 base), `--bg-raised` (#1f1d2e surface), `--bg-inset` (#26233a overlay)
    *   Text: `--text` (#e0def4), `--subtle` (#908caa), `--muted` (#6e6a86); lines: `--border` (#403d52), `--border-bright` (#524f67)
    *   Accents: `--rose` (#ebbcba cursor/active/h2/focus), `--gold` (#f6c177 dates/labels/chips), `--iris` (#c4a7e7 links), `--foam` (#9ccfd8 mode block/keywords), `--pine` (#31748f quiet structure), `--love` (#eb6f92 errors/404)
    *   Stick to this mapping when adding components; do not reintroduce glows or textured backgrounds.
*   **Type pairing:** `--font-display` (VT323, Google Fonts) for headings/nav/statusline; `--font-body` (CommitMono Nerd Font, self-hosted subset woff2 in `/assets/fonts/` — see its README) for copy. VT323 has one weight — never apply `bold` to display type. CommitMono ships 400/700 only — use `font-weight: 700` for bold, never 600.
*   **Korean text:** `index.html` loads Nanum Gothic Coding subset to ONLY the three glyphs 채정인 (`&text=` param). If you add any other Korean text, widen or remove the subset.
*   **Units:** `rem` for font sizes/padding; kebab-case class names; multi-line rules.
*   **Motion:** every animation/transition must have a `prefers-reduced-motion: reduce` override.

### JavaScript (`script.js`)

*   **Indentation:** 4 spaces. Modern vanilla ES6+ (`const`/`let`, arrow functions, template literals, single quotes, semicolons required).
*   **Execution:** wrap logic in `document.addEventListener('DOMContentLoaded', ...)`.
*   **Progressive enhancement:** the site must remain fully readable with JS disabled (typed boot line falls back to static text, sections fall back to visible).
*   **Observers:** Use `IntersectionObserver` for scroll-based effects; throttle scroll handlers with `requestAnimationFrame`.

## 3. Architecture & Patterns

### Interactivity (script.js)
*   **Centralization:** All interactivity lives in `script.js` (shared by static pages and Jekyll layouts). No inline JS in HTML.
*   Features: typed boot line, scroll reveal, active-nav highlighting (+`aria-current`), lite YouTube embeds, back-to-top, statusline scroll position + showcmd, and vim keyboard navigation (`j`/`k` scroll, `d`/`u` half page, `gg`/`G` top/bottom, `h`/`l` previous/next page, `?` help overlay, `Esc` close). The keydown handler must keep ignoring modifier combos and form fields, and the help overlay is built with `createElement` (no inline styles — CSP).

### Assets
*   **Images:** WebP preferred with fallbacks (`<picture>`).
*   **PDFs:** stored in `/assets`.

## 4. Git & Version Control

*   **Commit Messages:** Present tense, imperative style (e.g., "Add scroll animation").
*   **Branching:** Direct commits to `main` are acceptable for this personal project, but complex features should use feature branches.
*   **Never ignore `CNAME`:** it must stay committed or the custom domain breaks.
