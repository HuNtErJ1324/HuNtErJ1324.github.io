// MathJax 3 configuration. Loaded (as an external file, to satisfy the
// script-src 'self' CSP) BEFORE tex-svg.js, which reads this global.
//
// On GitHub Pages, kramdown converts markdown math written with $$...$$ into
// \(...\) for inline and \[...\] for display — so those are the delimiters
// MathJax needs to scan for. Single $...$ is intentionally NOT enabled, so
// literal dollar signs in prose are never mistaken for math.
window.MathJax = {
    tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']],
        processEscapes: true
    },
    options: {
        // Never typeset inside code/pre (rouge highlight blocks) or the help overlay.
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoreHtmlClass: 'highlight'
    }
};
