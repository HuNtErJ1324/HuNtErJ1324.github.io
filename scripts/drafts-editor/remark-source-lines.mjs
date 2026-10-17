// Tags rendered block elements with the source lines they came from
// (data-line / data-line-end), so the drafts editor can sync scrolling and
// jump from the preview to the source. Added by the drafts-editor integration
// under `astro dev` only; production HTML never carries these attributes.
//
// Components (<LineChart />, <Fold>, ...) are left alone: an extra prop could
// change what they render. The editor interpolates across them instead.
const BLOCKS = new Set([
    'heading',
    'paragraph',
    'blockquote',
    'list',
    'listItem',
    'code',
    'table',
    'tableRow',
    'thematicBreak',
    'containerDirective',
    'leafDirective'
]);

export function remarkSourceLines() {
    return (tree) => {
        const visit = (node) => {
            if (BLOCKS.has(node.type) && node.position) {
                node.data ??= {};
                node.data.hProperties = {
                    ...node.data.hProperties,
                    dataLine: node.position.start.line,
                    dataLineEnd: node.position.end.line
                };
            }
            node.children?.forEach(visit);
        };
        visit(tree);
    };
}
