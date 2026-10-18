import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'> | CollectionEntry<'drafts'>;

export const isDraft = (post: Post) => post.collection === 'drafts';

// YYYY-MM-DD. Front matter dates parse as UTC midnight, so this is the
// calendar date the author wrote.
export const formatDate = (date: Date) => date.toISOString().slice(0, 10);

// Published posts, plus drafts when running `astro dev`. Newest first.
// Production builds list no drafts: the drafts collection holds only drafts
// shared by link there (see getSharedDrafts), and this check (set by the
// drafts-gate integration) keeps those off every listing, tag page, and
// related-posts aside.
export async function getPosts(): Promise<Post[]> {
	const published = await getCollection('blog');
	const drafts = import.meta.env.ASTRO_SHOW_DRAFTS === 'true' ? await getCollection('drafts') : [];
	const publishedIds = new Set(published.map((post) => post.id));
	const visibleDrafts = drafts.filter((draft) => {
		if (!publishedIds.has(draft.id)) return true;
		console.warn(`[drafts] "${draft.id}" is already published; showing the published version.`);
		return false;
	});
	return [...published, ...visibleDrafts].sort(
		(a, b) => b.data.date.valueOf() - a.data.date.valueOf()
	);
}

// Drafts shared by link (`share:` front matter, set by npm run draft:share),
// each rendered at /drafts/<token>/. Under `astro dev` too, for previewing.
export async function getSharedDrafts() {
	const drafts = await getCollection('drafts');
	return drafts.flatMap((post) => (post.data.share ? [{ post, token: post.data.share }] : []));
}

// Reading time at 200 words a minute. Counts prose only: in .mdx posts,
// import/export lines, component props (chart data), and code blocks would
// otherwise inflate the estimate.
export function readingMinutes(post: Post): number {
	const prose = (post.body ?? '')
		.replace(/^(import|export)\s.*$/gm, '')
		.replace(/```[\s\S]*?```/g, '')
		.replace(/<[A-Z][\s\S]*?\/>/g, '')
		.replace(/<\/?[A-Z][^>]*>/g, '');
	const words = prose.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / 200));
}

// Up to `limit` other posts, ranked by shared tags (a shared category counts
// as one more). `posts` is newest first and the sort is stable, so ties (and
// posts with nothing in common, which fill any remaining slots) stay newest first.
export function relatedPosts(post: Post, posts: Post[], limit = 3): Post[] {
	const tags = new Set(post.data.tags);
	const score = (other: Post) =>
		other.data.tags.filter((tag) => tags.has(tag)).length +
		(post.data.category && other.data.category === post.data.category ? 1 : 0);
	return posts
		.filter((other) => other.id !== post.id)
		.map((other) => ({ other, score: score(other) }))
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map(({ other }) => other);
}
