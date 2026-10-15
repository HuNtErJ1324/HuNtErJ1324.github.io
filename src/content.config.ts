import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { z } from 'astro/zod';

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

// Production builds get no drafts. Clearing the store also drops any draft
// entries a dev session left in Astro's content cache (node_modules/.astro).
const noDrafts: Loader = {
	name: 'no-drafts',
	load: async ({ store }) => {
		store.clear();
	}
};

// Drafts live in ./drafts — a git-ignored clone of the PRIVATE blog-drafts
// repo — and are only loaded by `astro dev` (the drafts-gate integration in
// astro.config.mjs sets ASTRO_SHOW_DRAFTS from the CLI command).
const drafts = defineCollection({
	loader: import.meta.env.ASTRO_SHOW_DRAFTS === 'true'
		? glob({ pattern: ['**/*.{md,mdx}', '!**/README.md'], base: './drafts' })
		: noDrafts,
	schema: postSchema
});

export const collections = { blog, drafts };
