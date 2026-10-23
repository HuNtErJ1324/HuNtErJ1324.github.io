// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkDirective from 'remark-directive';
import remarkMath from 'remark-math';
import { remarkMathJax } from './src/plugins/remark-mathjax.js';
import { remarkTraceDirectives } from './src/plugins/remark-trace-directives.js';
import draftsEditor from './scripts/drafts-editor/integration.mjs';
import { draftsEditorOptions } from './scripts/drafts-editor-site.mjs';

// Drafts (./drafts) may only ever render under `astro dev`, except drafts
// shared by link (npm run draft:share), which builds render at /drafts/<token>/
// only. Gate on the CLI command, not import.meta.env.DEV: DEV just means
// NODE_ENV !== 'production', and `NODE_ENV=development astro build` or
// `--devOutput` would ship every draft.
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
	// draftsEditor serves the browser editor at /edit/ under `astro dev` only
	// (scripts/drafts-editor/, with this site's settings in
	// scripts/drafts-editor-site.mjs); it must come before mdx() so its
	// dev-only remark plugin reaches MDX too.
	integrations: [draftsGate, draftsEditor(draftsEditorOptions), mdx()],
	// Astro 7 defaults to JSX whitespace rules ('jsx'), which drop the spaces
	// between inline elements on separate lines (chips, "focus: …" meta, the
	// 404 links). Keep the HTML-aware compression the site was built with.
	compressHTML: true,
	markdown: {
		// The remark/rehype (unified) pipeline, not Astro 7's default Sätteri
		// processor: the plugins below are remark plugins. MDX inherits it.
		// GFM (tables, footnotes, autolinks) is on by default. $$…$$ math is
		// parsed by remark-math and rendered client-side by the self-hosted
		// MathJax bundle (see src/plugins/remark-mathjax.js).
		processor: unified({
			remarkPlugins: [
				[remarkMath, { singleDollarTextMath: false }],
				remarkMathJax,
				remarkDirective,
				remarkTraceDirectives
			]
		}),
		shikiConfig: {
			// Matches the site's Rosé Pine palette
			theme: 'rose-pine'
		}
	}
});
