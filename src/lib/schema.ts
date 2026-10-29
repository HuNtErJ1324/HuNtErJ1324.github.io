// Structured data (schema.org JSON-LD) shared by the home page and posts.
// The Person carries every name people search for (alternateName), and
// posts point their author at it by @id, so search engines tie the blog,
// the profiles in sameAs, and all of the names to one person. Keep sameAs
// in sync with the home page's contact links (profile URLs only).
const SITE = 'https://justin-chae.org';

export const PERSON_ID = `${SITE}/#person`;
export const WEBSITE_ID = `${SITE}/#website`;

export const person = {
	'@type': 'Person',
	'@id': PERSON_ID,
	name: 'Justin Yang Chae',
	alternateName: ['Justin Chae', 'HunterJ', 'HuNtErJ1324', '채정인'],
	givenName: 'Justin',
	additionalName: 'Yang',
	familyName: 'Chae',
	url: `${SITE}/`,
	image: `${SITE}/assets/profile_photo.jpg`,
	email: 'mailto:jcjustin.chae@gmail.com',
	affiliation: {
		'@type': 'CollegeOrUniversity',
		name: 'University of Washington'
	},
	knowsAbout: ['Machine Learning', 'Artificial Intelligence', 'Computer Science', 'Mathematics', 'Violin'],
	sameAs: [
		'https://www.linkedin.com/in/justin-c-92403120b',
		'https://scholar.google.com/citations?user=icnjuIMAAAAJ',
		'https://github.com/HuNtErJ1324',
		'https://x.com/HuNtEr_J1324'
	]
};

// Gives the site its name in search results
export const website = {
	'@type': 'WebSite',
	'@id': WEBSITE_ID,
	name: 'Justin Yang Chae',
	alternateName: ['Justin Chae', 'HunterJ', 'justin-chae.org'],
	url: `${SITE}/`,
	inLanguage: 'en',
	publisher: { '@id': PERSON_ID }
};

export const homeJsonLd = {
	'@context': 'https://schema.org',
	'@graph': [
		website,
		{
			'@type': 'ProfilePage',
			'@id': `${SITE}/#profile`,
			url: `${SITE}/`,
			name: 'Justin Yang Chae',
			isPartOf: { '@id': WEBSITE_ID },
			mainEntity: person
		}
	]
};

interface PostSchema {
	url: string;
	title: string;
	description: string;
	date: Date;
	image: string;
	tags: string[];
}

export const postJsonLd = ({ url, title, description, date, image, tags }: PostSchema) => ({
	'@context': 'https://schema.org',
	'@type': 'BlogPosting',
	'@id': `${url}#article`,
	mainEntityOfPage: url,
	url,
	headline: title,
	description,
	datePublished: date.toISOString(),
	image,
	inLanguage: 'en',
	keywords: tags.length ? tags.join(', ') : undefined,
	author: { '@type': 'Person', '@id': PERSON_ID, name: person.name, url: person.url },
	publisher: { '@type': 'Person', '@id': PERSON_ID, name: person.name, url: person.url },
	isPartOf: { '@id': WEBSITE_ID }
});
