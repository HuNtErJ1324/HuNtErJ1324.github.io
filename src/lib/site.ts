// Cloudflare caches static files in browsers for hours; tag the ones that
// change (home.css, script.js, the CV) with the deployed commit so a new
// deploy never pairs fresh HTML with stale assets. Empty outside CI (no
// GITHUB_SHA).
export const assetVersion = import.meta.env.GITHUB_SHA
	? `?v=${import.meta.env.GITHUB_SHA.slice(0, 7)}`
	: '';
