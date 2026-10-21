// Comments are self-hosted: Comentario (https://comentario.app) on the home
// server, public only through a Cloudflare Tunnel, with a Claude Haiku
// moderator. Its setup lives in comments-server/. Post.astro embeds it,
// Base.astro's post CSP allows this origin, and script.js §9 loads the widget.
// COMMENTS_URL points a build at another instance, e.g. a local one for testing.
const url = new URL(import.meta.env.COMMENTS_URL || 'https://comments.justin-chae.org');

export const comments = {
	origin: url.origin,
	// Live updates (new and newly approved comments) arrive over a WebSocket
	socketOrigin: `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`,
	script: `${url.origin}/comentario.js`
};
