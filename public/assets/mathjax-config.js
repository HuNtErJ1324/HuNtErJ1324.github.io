// MathJax 3 configuration. Loaded (as an external file, to satisfy the
// script-src 'self' CSP) BEFORE tex-svg.js, which reads this global.
//
// Posts write math as $$…$$; at build time remark-math + remark-mathjax turn
// it into \(…\) for inline and \[…\] for display math (see
// src/plugins/remark-mathjax.js). $$…$$ stays enabled for math in raw HTML.
// Single $…$ is intentionally NOT enabled, so literal dollar signs in prose
// are never mistaken for math.
//
// Readers' comments are typeset too (script.js §9b), so TeX from strangers
// must not reach the html extension (\href, \class, \style, \cssId, which put
// links and attributes in the page) or \unicode: neither may be autoloaded or
// \require'd. Only tex-svg.js is self-hosted, so no extension can load anyway.
window.MathJax = {
    tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]'], ['$$', '$$']],
        processEscapes: true,
        autoload: { html: [], unicode: [] },
        require: { allow: { html: false, unicode: false } }
    },
    options: {
        // Never typeset inside code blocks, inline code, or form fields
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
    }
};
