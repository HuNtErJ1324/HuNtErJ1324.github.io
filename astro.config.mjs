// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import remarkDirective from 'remark-directive';
import remarkGfm from 'remark-gfm';
import { remarkTraceDirectives } from './src/plugins/remark-trace-directives.js';

// Drafts (./drafts) may only ever render under `astro dev`. Gate on the CLI
// command, not import.meta.env.DEV: DEV just means NODE_ENV !== 'production',
// and `NODE_ENV=development astro build` or `--devOutput` would ship every draft.
// content.config.ts and src/lib/posts.ts read import.meta.env.ASTRO_SHOW_DRAFTS,
// which this defines at compile time.
const draftsGate = {
	name: 'drafts-gate',
	hooks: {
		'astro:config:setup': ({ command, updateConfig }) => {
			updateConfig({
				vite: {
					define: {
						'import.meta.env.ASTRO_SHOW_DRAFTS': JSON.stringify(command === 'dev' ? 'true' : 'false')
					}
				}
			});
		}
	}
};

// https://astro.build/config
export default defineConfig({
	site: 'https://justin-chae.org',
	integrations: [draftsGate, mdx()],
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
