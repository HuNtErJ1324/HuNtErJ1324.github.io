import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'> | CollectionEntry<'drafts'>;

export const isDraft = (post: Post) => post.collection === 'drafts';

// Published posts, plus drafts when running `astro dev`. Newest first.
// Production builds never see drafts: the drafts collection is empty there,
// and this check (set by the drafts-gate integration) keeps them out even if
// that ever changes.
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
