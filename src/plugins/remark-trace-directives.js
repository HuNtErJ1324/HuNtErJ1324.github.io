// Maps remark-directive containers onto the class conventions that
// public/script.js already understands (trace blocks, tldr callout).
// In a post, write:
//
//   :::tool-call
//   ```bash
//   some command
//   ```
//   :::
//
// and the fenced block's wrapper gets class "tool-call", which script.js
// upgrades into a numbered, collapsible trace panel. Prose works too:
//
//   :::annotation
//   Plain commentary paragraph.
//   :::
//
const KNOWN = new Set([
	'tool-call',
	'tool-output',
	'annotation',
	'reasoning',
	'bibtex',
	'tldr'
]);

// The exact source text of a node, e.g. ":important" for a text directive
const sourceOf = (node, file) => {
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;
	if (start === undefined || end === undefined) return `:${node.name}`;
	return String(file.value).slice(start, end);
};

export function remarkTraceDirectives() {
	return (tree, file) => {
		const visit = (node) => {
			if (!node.children) return;
			for (let i = 0; i < node.children.length; i += 1) {
				const child = node.children[i];
				if (child.type === 'textDirective') {
					// remark-directive also reads prose such as "Note:important" or
					// "re:Invent" as a text directive (:important), which would drop
					// the word. No text directives are used, so put the text back.
					node.children[i] = { type: 'text', value: sourceOf(child, file) };
					continue;
				}
				visit(child);
				if (child.type !== 'containerDirective' && child.type !== 'leafDirective') continue;
				if (KNOWN.has(child.name)) {
					child.data ??= {};
					child.data.hName = child.type === 'leafDirective' ? 'p' : 'div';
					child.data.hProperties = { className: [child.name] };
				} else {
					console.warn(
						`[trace-directives] ${file.path ?? 'post'}: unknown directive "${child.name}" ` +
						`(known: ${[...KNOWN].join(', ')}); rendering it as a plain block.`
					);
				}
			}
		};
		visit(tree);
	};
}
