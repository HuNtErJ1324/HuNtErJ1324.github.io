// giscus comments (https://giscus.app): each post maps to a GitHub Discussion
// in this repo's Announcements category, matched by the fixed term
// "blog/<slug>/" (data-mapping="specific", set in Post.astro).
// IDs come from: gh api graphql -f query='{ repository(owner:"HuNtErJ1324",
//   name:"HuNtErJ1324.github.io") { id discussionCategories(first: 20) { nodes { id name } } } }'
export const giscus = {
	repo: 'HuNtErJ1324/HuNtErJ1324.github.io',
	repoId: 'R_kgDOLSN6eQ',
	category: 'Announcements',
	categoryId: 'DIC_kwDOLSN6ec4DHa_2',
	discussionsUrl: 'https://github.com/HuNtErJ1324/HuNtErJ1324.github.io/discussions/categories/announcements'
};
