// Hands remark-math's nodes to the self-hosted MathJax bundle (loaded by
// Post.astro). With singleDollarTextMath off, remark-math reads $$…$$ the way
// kramdown did on the Jekyll site: inside a sentence it is inline math; a
// fenced $$ block, or a paragraph holding nothing but one $$…$$, is display
// math. The TeX is emitted as plain text between MathJax's \(…\) / \[…\]
// delimiters, so markdown no longer eats backslash escapes (\{ \; \\) or
// reads _…_ / *…* inside it as emphasis.
//
// Posts that contain math get remarkPluginFrontmatter.hasMath, so only those
// pages download MathJax. In .mdx that includes <Tex> (src/components/blog/
// Tex.astro), which emits the same \(…\) / \[…\] text for MathJax.
const inline = (value) => ({
	hName: 'span',
	hProperties: { className: ['math', 'math-inline'] },
	hChildren: [{ type: 'text', value: `\\(${value}\\)` }]
});

const display = (value) => ({
	hName: 'div',
	hProperties: { className: ['math', 'math-display'] },
	hChildren: [{ type: 'text', value: `\\[${value}\\]` }]
});

const isBlank = (node) => node.type === 'text' && node.value.trim() === '';

export function remarkMathJax() {
	return (tree, file) => {
		let hasMath = false;

		const visit = (node) => {
			if (!node.children) return;
			for (let i = 0; i < node.children.length; i += 1) {
				const child = node.children[i];
				if ((child.type === 'mdxJsxFlowElement' || child.type === 'mdxJsxTextElement') && child.name === 'Tex') {
					hasMath = true;
				}
				if (child.type === 'math') {
					child.data = display(child.value);
					hasMath = true;
				} else if (child.type === 'inlineMath') {
					child.data = inline(child.value);
					hasMath = true;
				} else if (child.type === 'paragraph') {
					const content = child.children.filter((grandchild) => !isBlank(grandchild));
					if (content.length === 1 && content[0].type === 'inlineMath') {
						// A paragraph that is just $$…$$ is display math, as in kramdown
						node.children[i] = { type: 'math', value: content[0].value, data: display(content[0].value) };
						hasMath = true;
						continue;
					}
					visit(child);
				} else {
					visit(child);
				}
			}
		};
		visit(tree);

		if (hasMath) {
			file.data.astro ??= {};
			file.data.astro.frontmatter ??= {};
			file.data.astro.frontmatter.hasMath = true;
		}
	};
}
