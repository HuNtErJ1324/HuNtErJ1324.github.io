import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { sharedDrafts, shareTokenPattern } from '../scripts/shared-drafts.mjs';

const postSchema = z.object({
	title: z.string(),
	description: z.string(),
	date: z.coerce.date(),
	category: z.string().optional(),
	// Tags become URL segments (/blog/tag/<tag>/), so keep them kebab-case
	tags: z.array(
		z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { error: 'tags must be kebab-case, e.g. "llm-reasoning"' })
	).default([]),
	// Set to false to hide the giscus comments section on a post
	comments: z.boolean().default(true)
});

const blog = defineCollection({
	loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
	schema: postSchema
});

// A build with no shared drafts loads none. Clearing the store also drops any
// draft entries a dev session left in Astro's content cache (node_modules/.astro).
const noDrafts: Loader = {
	name: 'no-drafts',
	load: async ({ store }) => {
		store.clear();
	}
};

// Drafts live in ./drafts — a git-ignored clone of the PRIVATE blog-drafts
// repo. `astro dev` loads all of them (the drafts-gate integration in
// astro.config.mjs sets ASTRO_SHOW_DRAFTS from the CLI command). Every other
// command loads only drafts shared by link (`share:` front matter), which
// render at /drafts/<token>/ and nowhere else. The files are picked before the
// glob runs, so an unfinished, unshared draft can't break a production build.
const sharedDraftsLoader = (): Loader => {
	const files = sharedDrafts('./drafts').map(({ file }) => file);
	return files.length > 0 ? glob({ pattern: files, base: './drafts' }) : noDrafts;
};

const shareError = 'share must be a random token; set it with npm run draft:share -- <slug>';

const drafts = defineCollection({
	loader: import.meta.env.ASTRO_SHOW_DRAFTS === 'true'
		? glob({ pattern: ['**/*.{md,mdx}', '!**/README.md'], base: './drafts' })
		: sharedDraftsLoader(),
	schema: postSchema.extend({
		// Shares the draft at /drafts/<share>/; set by npm run draft:share
		share: z.string({ error: shareError }).regex(shareTokenPattern, { error: shareError }).optional()
	})
});

export const collections = { blog, drafts };
