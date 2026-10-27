// This site's settings for the drafts editor (scripts/drafts-editor/, which
// stays generic: it is published as github.com/HuNtErJ1324/astro-drafts-editor).
// astro.config.mjs passes them to draftsEditor().

const LINE_CHART = `<LineChart
\ttitle="\${Title}"
\tsubtitle="\${What the axes show}"
\tseries={[
\t\t{ name: '\${Series}', color: 'blue', markers: true, points: [[0, 1], [1, 2], [2, 1.5]] }
\t]}
\tx={{ label: 'step', min: 0, max: 2, ticks: [0, 1, 2], format: 'int' }}
\ty={{ min: 0, max: 2, ticks: [0, 1, 2], format: 'dec1' }}
\tcaption="\${Caption}"
/>`;

const BAR_CHART = `<BarChart
\ttitle="\${Title}"
\tsubtitle="\${What the bars show}"
\tmax={1}
\trows={[
\t\t{ label: '\${First}', value: 0.6, color: 'blue' },
\t\t{ label: '\${Second}', value: 0.4, color: 'gold' }
\t]}
/>`;

// Insert-menu items for the components in src/components/blog/ and the trace
// directives; the editor adds the Markdown basics (footnote, image, heading,
// table, code block) itself
const snippets = [
    { group: 'Math', label: 'Inline math', imports: ['Tex'], template: '<Tex tex="${x}" />' },
    { group: 'Math', label: 'Display math', imports: ['Tex'], template: '<Tex block tex={String.raw`${x}`} />', block: true },
    { group: 'Callouts', label: 'TL;DR', template: ':::tldr\n${}\n:::', block: true },
    { group: 'Callouts', label: 'Collapsible section', imports: ['Fold'], template: '<Fold summary="${Summary}" hint="${hint}">\n\n${}\n\n</Fold>', block: true },
    { group: 'Agent traces', label: 'Chat excerpt', imports: ['Chat', 'ChatMessage'], template: '<Chat caption="${Caption}">\n\t<ChatMessage name="${Model}" meta="${meta}" color="${love}">${Message}</ChatMessage>\n\t<ChatMessage role="tool" tool="${tool}">${Result}</ChatMessage>\n</Chat>', block: true },
    { group: 'Agent traces', label: 'Chat message', imports: ['ChatMessage'], template: '<ChatMessage name="${Model}" meta="${meta}" color="${love}">${Message}</ChatMessage>' },
    { group: 'Agent traces', label: 'Tool call', template: ':::tool-call\n```bash\n${}\n```\n:::', block: true },
    { group: 'Agent traces', label: 'Tool output', template: ':::tool-output\n```\n${}\n```\n:::', block: true },
    { group: 'Agent traces', label: 'Reasoning (collapsed)', template: ':::reasoning\n${}\n:::', block: true },
    { group: 'Agent traces', label: 'Annotation', template: ':::annotation\n${}\n:::', block: true },
    { group: 'Figures', label: 'Line chart', imports: ['LineChart'], template: LINE_CHART, block: true },
    { group: 'Figures', label: 'Bar chart', imports: ['BarChart'], template: BAR_CHART, block: true },
    { group: 'Figures', label: 'Two-up grid', imports: ['Grid'], template: '<Grid>\n\n${}\n\n</Grid>', block: true },
    { group: 'Figures', label: 'Tweet card', imports: ['Tweet'], template: '<Tweet name="${Name}" handle="${handle}" date="${Oct 1, 2026}" url="${https://x.com/}" caption="${Caption}">\n\n${Post text}\n\n</Tweet>', block: true },
    { group: 'End matter', label: 'Citation (BibTeX)', template: '## Citation\n\n:::bibtex\n```bibtex\n${}\n```\n:::', block: true }
];

export const draftsEditorOptions = {
    drafts: 'drafts',
    preview: '/blog/[slug]/',
    published: 'src/content/blog',
    components: 'src/components/blog',
    componentImport: '@/components/blog/[name].astro',
    assets: 'public/assets/blog/[slug]',
    required: ['title', 'description', 'date'],
    // "+ new" in the editor; keep in step with scripts/new-draft.mjs
    template: ({ title, date }) => `---
title: ${JSON.stringify(title)}
description: "One-line summary shown on the blog index."
date: ${date}
# category: research
tags: []
---

Start writing here.
`,
    snippets,
    // "publish" in the editor, after it sets date: to today; keep in step with
    // scripts/publish-draft.mjs, which does the same from the command line
    publish: ({ source }) => {
        const notes = ['Then npm run drafts:sync records the move in the drafts repo.'];
        const frontMatter = /^---\r?\n[\s\S]*?\r?\n---/.exec(source)?.[0];
        if (!frontMatter || !/^share:/m.test(frontMatter)) return { source, notes };
        notes.push('Its share: token is gone, so the shared /drafts/ link stops working once drafts:sync records the move and the site redeploys.');
        return { source: frontMatter.replace(/^share:.*\r?\n/m, '') + source.slice(frontMatter.length), notes };
    },
    css: ['scripts/drafts-editor-site.css']
};
