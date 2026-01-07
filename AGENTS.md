# AGENTS.md

This document serves as the primary source of truth for coding agents (AI) operating within this repository. It defines the build environment, code style, and architectural conventions for the personal portfolio website of Justin Yang Chae.

## 1. Project Overview & Environment

*   **Type:** Static Website (HTML5, CSS3, Vanilla JavaScript).
*   **Hosting:** GitHub Pages.
*   **Structure:**
    *   Root: HTML files (`index.html`, `music.html`) and scripts (`script.js`, `home.css`).
    *   `/assets`: Images, favicons, PDFs.

### Build & Run Commands

Since this is a static site, there is no compilation step.

*   **Run Development:** Open `index.html` in any modern web browser.
    *   *Agent Tip:* You do not need to run `npm start` or similar commands.
*   **Testing:** Manual visual verification is required.
    *   **Unit Tests:** None exist.
    *   **Verify Changes:** Open the modified HTML file in a browser or use a simple HTTP server (e.g., `python3 -m http.server`) to verify resource loading.

## 2. Code Style & Conventions

### HTML (`.html`)

*   **Indentation:** Use **Tabs** for indentation (detected in existing files).
*   **Semantics:** deeply prioritized. Use `<nav>`, `<header>`, `<main>`, `<section>`, `<footer>` appropriately.
*   **Attributes:**
    *   Use double quotes `""`.
    *   `alt` tags are mandatory for images.
    *   `aria-label` required for interactive elements without text labels.
*   **Performance:**
    *   Use lazy loading for images (`loading="lazy"`).
    *   **YouTube Embeds:** Do NOT use raw `<iframe>`s. Use the "Lite" embed pattern implemented in `script.js` (placeholder image + click listener).

### CSS (`.css`)

*   **Theme:** Dark mode by default.
*   **Variables:** Use CSS variables (defined in `:root`) for all colors.
    *   `--primary-color`: Text/Highlight (#f5f5f5)
    *   `--secondary-color`: Background (#0a0a0a)
*   **Units:** Use `rem` for font sizes/padding, `vh`/`vw` for layout structures where appropriate.
*   **Formatting:**
    *   Multi-line rules.
    *   Kebab-case class names (e.g., `.profile-container`).

### JavaScript (`.js`)

*   **Indentation:** Use **4 Spaces**.
*   **Syntax:** Modern Vanilla JS (ES6+).
    *   Use `const` and `let`. Avoid `var`.
    *   Arrow functions `() => {}` preferred for callbacks.
    *   Use Template Literals `` `String ${value}` ``.
*   **Quotes:** Use single quotes `'` for strings, unless strictly necessary otherwise.
*   **Semicolons:** **Required** at the end of statements.
*   **Execution:** Wrap logic in `document.addEventListener('DOMContentLoaded', ...)` to ensure DOM readiness.
*   **Naming:** CamelCase for variables/functions (e.g., `revealObserver`).

## 3. Architecture & Patterns

### Interactivity (script.js)
*   **Centralization:** All interactivity logic resides in `script.js`. Do not put inline JS in HTML.
*   **Observers:** Use `IntersectionObserver` for scroll-based effects (reveals, active nav) to maintain performance.

### Assets
*   **Images:** WebP format preferred for photos where possible (`.webp`), with fallbacks if necessary.
*   **PDFs:** Stored in `/assets` for download (CV, posters).

## 4. Git & Version Control

*   **Commit Messages:** Present tense, imperative style (e.g., "Add scroll animation", "Fix navigation bug").
*   **Branching:** Direct commits to `main` are acceptable for this personal project, but complex features should use feature branches.
