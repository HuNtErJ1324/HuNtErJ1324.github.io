// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import { remarkTraceDirectives } from './src/plugins/remark-trace-directives.js';

// https://astro.build/config
export default defineConfig({
	site: 'https://justin-chae.org',
	integrations: [mdx()],
	markdown: {
		// Math stays literal ($$…$$) and is rendered client-side by the
		// self-hosted MathJax bundle, exactly as on the Jekyll site.
		remarkPlugins: [remarkDirective, remarkTraceDirectives, remarkGfm],
		shikiConfig: {
			// Matches the site's Rosé Pine palette
			theme: 'rose-pine'
		}
	}
});
