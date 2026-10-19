// Markdown for the agent-written text in the trace viewer (messages, thinking,
// context summaries, the task prompt), rendered at build time with the same
// remark/rehype pipeline Astro uses for posts. The text is model output, so it
// is handled as untrusted:
// - raw HTML stays literal text (an agent writing "<HOLDING>" shows just that):
//   tag-like "<" is escaped outside code before parsing, because a line opening
//   with a tag (context summaries start "<summary>") would otherwise begin an
//   HTML block that swallows the markdown after it;
// - single newlines stay line breaks, since agents write line by line;
// - links keep only http(s) and #anchors, marked nofollow; images become links;
// - headings become bold lines, so hundreds of agent headings stay out of the
//   page outline and never take ids that clash with the #turn-N anchors;
// - no smart quotes and no syntax colors: the text reads exactly as written,
//   and Shiki's inline styles would break the page's strict CSP anyway.
import { unified } from '@astrojs/markdown-remark';

interface Node {
	type: string;
	tagName?: string;
	value?: string;
	url?: string;
	alt?: string | null;
	properties?: Record<string, unknown>;
	children?: Node[];
}

const walk = (node: Node, visit: (node: Node) => void) => {
	visit(node);
	node.children?.forEach((child) => walk(child, visit));
};

const safeUrl = (url: unknown) => typeof url === 'string' && /^(https?:\/\/|#)/i.test(url.trim());

// Backslash-escape "<" that could open a tag, except inside fenced code blocks
// and inline code, where markdown shows text as written
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const escapeTags = (text: string) => {
	let fence: string | null = null;
	return text
		.split('\n')
		.map((line) => {
			const open = line.match(FENCE);
			if (fence) {
				if (open && open[1][0] === fence[0] && open[1].length >= fence.length) fence = null;
				return line;
			}
			if (open) {
				fence = open[1];
				return line;
			}
			return line
				.split(/(`+[^`]*`+)/)
				.map((part, i) => (i % 2 ? part : part.replace(/<(?=[A-Za-z/!?])/g, '\\<')))
				.join('');
		})
		.join('\n');
};

// mdast: before remark-rehype and before Astro collects images
const remarkAgentText = () => (tree: Node) =>
	walk(tree, (node) => {
		if (node.type === 'html') {
			node.type = 'text';
		} else if (['paragraph', 'heading', 'emphasis', 'strong', 'delete', 'link'].includes(node.type)) {
			// Single newlines in prose become <br>, as in a chat transcript
			node.children = node.children?.flatMap((child) =>
				child.type === 'text' && child.value?.includes('\n')
					? child.value.split('\n').flatMap((value, i) => (i ? [{ type: 'break' }, { type: 'text', value }] : [{ type: 'text', value }]))
					: [child]
			);
		} else if (node.type === 'image') {
			const label = node.alt || node.url || 'image';
			if (safeUrl(node.url)) {
				Object.assign(node, { type: 'link', children: [{ type: 'text', value: label }] });
			} else {
				Object.assign(node, { type: 'text', value: label });
			}
		}
	});

// hast: before Astro adds heading ids
const rehypeAgentText = () => (tree: Node) =>
	walk(tree, (node) => {
		if (node.type !== 'element') return;
		const props = (node.properties ??= {});
		delete props.id;
		if (/^h[1-6]$/.test(node.tagName ?? '')) {
			node.tagName = 'p';
			node.properties = { className: ['tv-md-h'] };
		} else if (node.tagName === 'a') {
			if (safeUrl(props.href)) {
				props.rel = ['nofollow', 'noopener', 'noreferrer'];
			} else {
				node.tagName = 'span';
				delete props.href;
			}
		}
	});

const renderer = unified({
	remarkPlugins: [remarkAgentText],
	rehypePlugins: [rehypeAgentText],
	smartypants: false
}).createRenderer({ syntaxHighlight: false });

const cache = new Map<string, string>();

export async function agentMarkdown(text: string): Promise<string> {
	const hit = cache.get(text);
	if (hit !== undefined) return hit;
	const html = (await (await renderer).render(escapeTags(text))).code;
	cache.set(text, html);
	return html;
}
