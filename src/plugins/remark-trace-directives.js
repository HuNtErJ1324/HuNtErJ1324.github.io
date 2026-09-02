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

export function remarkTraceDirectives() {
	return (tree) => {
		const visit = (node) => {
			if (!node.children) return;
			for (const child of [...node.children]) {
				visit(child);
				if (
					(child.type === 'containerDirective' || child.type === 'leafDirective') &&
					KNOWN.has(child.name)
				) {
					child.data ??= {};
					child.data.hName = child.type === 'leafDirective' ? 'p' : 'div';
					child.data.hProperties = { className: [child.name] };
				}
			}
		};
		visit(tree);
	};
}
