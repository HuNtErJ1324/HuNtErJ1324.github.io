import { getCollection } from 'astro:content';

export async function GET({ site }) {
	const url = (path) => new URL(path, site).href;
	const posts = (await getCollection('blog')).sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf()
	);
	const entries = [
		{ loc: url('/'), priority: '1.0' },
		{ loc: url('/music/'), priority: '0.8' },
		{ loc: url('/blog/'), priority: '0.8' },
		...posts.map((p) => ({
			loc: url(`/blog/${p.id}/`),
			lastmod: p.data.date.toISOString(),
			priority: '0.6'
		}))
	];
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(e) => `  <url>
    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
    <priority>${e.priority}</priority>
  </url>`
	)
	.join('\n')}
</urlset>
`;
	return new Response(xml, {
		headers: { 'Content-Type': 'application/xml; charset=utf-8' }
	});
}
