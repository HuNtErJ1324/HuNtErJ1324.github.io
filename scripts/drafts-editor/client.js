// Drafts editor client (dev only). Vite serves and bundles this module for
// the page that scripts/drafts-editor/integration.mjs serves at /edit/.
//
// The source pane is CodeMirror; every edit autosaves to drafts/<slug>.mdx.
// The preview pane holds two iframes of /edit/preview/<slug>/: when Astro
// re-renders, the hidden one loads the new version, scrolls to the reader's
// place, and swaps in, so the preview never flashes or jumps.
import { autocompletion, completionKeymap, snippet } from '@codemirror/autocomplete';
import { defaultKeymap, history as undoHistory, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { yamlFrontmatter } from '@codemirror/lang-yaml';
import {
    bracketMatching,
    foldGutter,
    foldKeymap,
    HighlightStyle,
    indentOnInput,
    indentUnit,
    syntaxHighlighting
} from '@codemirror/language';
import { lintGutter, lintKeymap, nextDiagnostic, setDiagnostics } from '@codemirror/lint';
import { highlightSelectionMatches, search, searchKeymap } from '@codemirror/search';
import { Compartment, EditorSelection, EditorState, Transaction } from '@codemirror/state';
import {
    Decoration,
    drawSelection,
    dropCursor,
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    MatchDecorator,
    ViewPlugin
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { getCM, Vim, vim } from '@replit/codemirror-vim';

const $ = (selector) => document.querySelector(selector);
const els = {
    select: $('#draft-select'),
    newButton: $('#new-draft'),
    insertButton: $('#insert-button'),
    insertMenu: $('#insert-menu'),
    saveStatus: $('#save-status'),
    sync: $('#sync-scroll'),
    vim: $('#vim-mode'),
    openPost: $('#open-post'),
    banner: $('#banner'),
    panes: $('#panes'),
    divider: $('#divider'),
    editor: $('#editor'),
    previewPane: $('.pane-preview'),
    previewError: $('#preview-error'),
    previewErrorTitle: $('#preview-error-title'),
    previewErrorText: $('#preview-error-text'),
    previewErrorJump: $('#preview-error-jump'),
    previewBusy: $('#preview-busy'),
    cursorPos: $('#cursor-pos'),
    wordCount: $('#word-count'),
    problemCount: $('#problem-count'),
    filePath: $('#file-path'),
    newDialog: $('#new-dialog'),
    newForm: $('#new-form'),
    newTitle: $('#new-title'),
    newSlug: $('#new-slug'),
    newSlugPreview: $('#new-slug-preview'),
    newError: $('#new-error'),
    newCancel: $('#new-cancel'),
    imageInput: $('#image-input')
};

const SAVE_DELAY = 450;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const normalize = (text) => text.replace(/\r\n?/g, '\n');

// Per-browser conveniences only (layout, last draft, cursor); the files on
// disk are the source of truth.
const store = {
    get(key, fallback) {
        try {
            const value = localStorage.getItem(`drafts-editor:${key}`);
            return value == null ? fallback : JSON.parse(value);
        } catch {
            return fallback;
        }
    },
    set(key, value) {
        try {
            if (value === undefined) localStorage.removeItem(`drafts-editor:${key}`);
            else localStorage.setItem(`drafts-editor:${key}`, JSON.stringify(value));
        } catch {
            // Storage blocked: nothing to remember
        }
    }
};

async function api(path, { method = 'GET', body } = {}) {
    const headers = { 'X-Drafts-Editor': '1' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`/edit/api/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

// ---------------------------------------------------------------------------
// Editor setup
// ---------------------------------------------------------------------------

const theme = EditorView.theme({
    '&': {
        height: '100%',
        color: 'var(--text)',
        backgroundColor: 'var(--bg)',
        fontSize: '0.95rem'
    },
    '.cm-scroller': {
        fontFamily: 'var(--font-body)',
        lineHeight: '1.7'
    },
    '.cm-content': {
        maxWidth: '52rem',
        padding: '1.25rem 0 45vh',
        caretColor: 'var(--rose)'
    },
    '.cm-line': {
        padding: '0 1.5rem 0 0.75rem'
    },
    '.cm-gutters': {
        backgroundColor: 'var(--bg)',
        color: 'var(--muted)',
        border: 'none'
    },
    '.cm-activeLine': {
        backgroundColor: 'rgb(38 35 58 / 0.6)'
    },
    '.cm-activeLineGutter': {
        backgroundColor: 'transparent',
        color: 'var(--subtle)'
    },
    '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--rose)',
        borderLeftWidth: '2px'
    },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'rgb(82 79 103 / 0.75)'
    },
    '.cm-selectionMatch': {
        backgroundColor: 'rgb(196 167 231 / 0.15)'
    },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
        backgroundColor: 'transparent',
        outline: '1px solid var(--border-bright)'
    },
    '.cm-foldPlaceholder': {
        backgroundColor: 'var(--bg-inset)',
        border: '1px solid var(--border)',
        color: 'var(--subtle)'
    },
    '.cm-tooltip': {
        backgroundColor: 'var(--bg-raised)',
        border: '1px solid var(--border-bright)',
        color: 'var(--text)'
    },
    '.cm-tooltip-autocomplete > ul': {
        fontFamily: 'var(--font-body)'
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
        backgroundColor: 'var(--bg-inset)',
        color: 'var(--rose)'
    },
    '.cm-completionDetail': {
        color: 'var(--muted)',
        fontStyle: 'normal',
        marginLeft: '1em'
    },
    '.cm-panels': {
        backgroundColor: 'var(--bg-raised)',
        color: 'var(--text)'
    },
    '.cm-panels-top': {
        borderBottom: '1px solid var(--border)'
    },
    '.cm-panel input, .cm-panel button, .cm-textfield, .cm-button': {
        backgroundColor: 'var(--bg-inset)',
        backgroundImage: 'none',
        border: '1px solid var(--border)',
        color: 'var(--text)',
        borderRadius: '4px'
    },
    '.cm-searchMatch': {
        backgroundColor: 'rgb(246 193 119 / 0.22)'
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
        backgroundColor: 'rgb(235 188 186 / 0.4)'
    },
    '.cm-diagnostic-error': {
        borderLeftColor: 'var(--love)'
    },
    '.cm-fat-cursor': {
        background: 'var(--rose) !important',
        color: 'var(--bg) !important'
    },
    '&:not(.cm-focused) .cm-fat-cursor': {
        background: 'none !important',
        outline: '1px solid var(--rose)'
    },
    '.cm-vim-panel': {
        padding: '0.15rem 0.75rem',
        borderTop: '1px solid var(--border)',
        backgroundColor: 'var(--bg-raised)',
        color: 'var(--gold)',
        fontFamily: 'var(--font-body)'
    },
    '.cm-vim-panel input': {
        color: 'var(--text)',
        fontFamily: 'var(--font-body)'
    },
    '.cm-mdx-esm': { color: 'var(--muted)' },
    '.cm-mdx-tag': { color: 'var(--foam)' },
    '.cm-mdx-comment': { color: 'var(--muted)', fontStyle: 'italic' },
    '.cm-mdx-directive': { color: 'var(--gold)' },
    '.cm-footnote-ref': { color: 'var(--iris)' }
}, { dark: true });

const highlightStyle = HighlightStyle.define([
    { tag: t.heading, color: 'var(--rose)', fontWeight: '700' },
    { tag: t.strong, fontWeight: '700' },
    { tag: t.emphasis, fontStyle: 'italic' },
    { tag: t.strikethrough, textDecoration: 'line-through' },
    { tag: t.link, color: 'var(--iris)' },
    { tag: t.url, color: 'var(--subtle)' },
    { tag: t.monospace, color: 'var(--foam)' },
    { tag: t.quote, color: 'var(--subtle)', fontStyle: 'italic' },
    { tag: [t.processingInstruction, t.contentSeparator, t.meta], color: 'var(--muted)' },
    { tag: t.labelName, color: 'var(--iris)' },
    { tag: [t.tagName, t.angleBracket], color: 'var(--foam)' },
    { tag: [t.attributeName, t.propertyName, t.definition(t.propertyName)], color: 'var(--gold)' },
    { tag: [t.number, t.bool, t.null], color: 'var(--iris)' },
    { tag: [t.attributeValue, t.string], color: 'var(--subtle)' },
    { tag: t.comment, color: 'var(--muted)', fontStyle: 'italic' },
    { tag: t.escape, color: 'var(--gold)' }
]);

// MDX bits the markdown grammar doesn't know: ESM lines, component tags,
// {/* comments */}, ::: directives and [^footnote] references.
const mdxMarks = new MatchDecorator({
    regexp: /^(?:import|export)\s.*$|\{\/\*.*?\*\/\}|<\/?[A-Z][\w.]*|\/>|^:{3,}[\w-]*|\[\^[^\]\s]+\]/g,
    decoration: (match) => {
        const text = match[0];
        if (/^(import|export)/.test(text)) return Decoration.mark({ class: 'cm-mdx-esm' });
        if (text.startsWith('{/*')) return Decoration.mark({ class: 'cm-mdx-comment' });
        if (text.startsWith(':')) return Decoration.mark({ class: 'cm-mdx-directive' });
        if (text.startsWith('[^')) return Decoration.mark({ class: 'cm-footnote-ref' });
        return Decoration.mark({ class: 'cm-mdx-tag' });
    }
});

const mdxHighlighter = ViewPlugin.fromClass(class {
    constructor(view) {
        this.decorations = mdxMarks.createDeco(view);
    }

    update(update) {
        this.decorations = mdxMarks.updateDeco(update, this.decorations);
    }
}, { decorations: (plugin) => plugin.decorations });

// ---------------------------------------------------------------------------
// Draft state and saving
// ---------------------------------------------------------------------------

const draft = {
    slug: null,
    ext: '.mdx',
    file: '',
    savedText: '',
    savedHash: '',
    conflict: null,
    problems: [],
    again: false,
    pendingDiskCheck: false
};
let drafts = [];
let components = [];
let saveTimer = 0;
let retryTimer = 0;
let currentSave = null;

function setStatus(state, text) {
    els.saveStatus.dataset.state = state;
    els.saveStatus.textContent = text;
}

let flashTimer = 0;
function flash(text, ms = 3500) {
    const previous = { state: els.saveStatus.dataset.state, text: els.saveStatus.textContent };
    setStatus('info', text);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
        if (els.saveStatus.dataset.state === 'info') setStatus(previous.state, previous.text);
    }, ms);
}

function scheduleSave() {
    if (!draft.slug || draft.conflict) return;
    setStatus('editing', 'editing…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, SAVE_DELAY);
}

function save() {
    clearTimeout(saveTimer);
    if (currentSave) {
        draft.again = true;
        return currentSave;
    }
    currentSave = writeDraft().finally(() => {
        currentSave = null;
        if (draft.pendingDiskCheck) {
            draft.pendingDiskCheck = false;
            checkDisk();
        }
        if (draft.again) {
            draft.again = false;
            return save();
        }
        return undefined;
    });
    return currentSave;
}

async function writeDraft() {
    if (!draft.slug || draft.conflict) return;
    const slug = draft.slug;
    const text = view.state.doc.toString();
    if (text === draft.savedText) {
        setStatus('saved', 'saved');
        return;
    }
    setStatus('saving', 'saving…');
    try {
        const { status, data } = await api(`drafts/${slug}`, {
            method: 'PUT',
            body: { content: text, baseHash: draft.savedHash }
        });
        if (slug !== draft.slug) return;
        if (status === 409) {
            enterConflict(normalize(data.content), data.hash);
            return;
        }
        if (status !== 200) throw new Error(data.error ?? `HTTP ${status}`);
        draft.savedText = text;
        draft.savedHash = data.hash;
        clearTimeout(retryTimer);
        store.set(`backup:${slug}`, undefined);
        showProblems(data.problems ?? []);
        if (view.state.doc.toString() === text) setStatus('saved', 'saved');
    } catch (err) {
        console.error('[drafts editor] save failed', err);
        setStatus('error', 'not saved, retrying');
        store.set(`backup:${slug}`, { text, baseHash: draft.savedHash, time: Date.now() });
        clearTimeout(retryTimer);
        retryTimer = setTimeout(save, 3000);
    }
}

function flushSave() {
    clearTimeout(saveTimer);
    return save();
}

// Swap the editor's text for `text` as one minimal change, so the cursor and
// scroll position survive an outside edit.
function replaceDoc(text, { remote = true } = {}) {
    const old = view.state.doc.toString();
    if (old === text) return;
    let start = 0;
    while (start < old.length && start < text.length && old[start] === text[start]) start++;
    let endOld = old.length;
    let endNew = text.length;
    while (endOld > start && endNew > start && old[endOld - 1] === text[endNew - 1]) {
        endOld--;
        endNew--;
    }
    view.dispatch({
        changes: { from: start, to: endOld, insert: text.slice(start, endNew) },
        annotations: remote ? Transaction.remote.of(true) : undefined
    });
}

function enterConflict(diskText, diskHash) {
    draft.conflict = { text: diskText, hash: diskHash };
    clearTimeout(saveTimer);
    setStatus('conflict', 'changed on disk');
    showBanner(`${draft.file} changed on disk while you had unsaved edits here.`, 'warn', [
        {
            label: 'load the disk version',
            run: () => {
                draft.conflict = null;
                replaceDoc(diskText);
                draft.savedText = diskText;
                draft.savedHash = diskHash;
                hideBanner();
                setStatus('saved', 'saved');
            }
        },
        {
            label: 'keep mine (overwrite the file)',
            run: () => {
                draft.conflict = null;
                draft.savedHash = diskHash;
                hideBanner();
                save();
            }
        }
    ]);
}

// A draft changed on disk: take it if there are no local edits, else ask.
async function checkDisk() {
    const slug = draft.slug;
    if (!slug) return;
    const { status, data } = await api(`drafts/${slug}`);
    if (status !== 200 || slug !== draft.slug || data.hash === draft.savedHash) return;
    const disk = normalize(data.content);
    if (view.state.doc.toString() === draft.savedText) {
        replaceDoc(disk);
        draft.savedText = disk;
        draft.savedHash = data.hash;
        showProblems(data.problems ?? []);
        flash('reloaded from disk');
    } else {
        enterConflict(disk, data.hash);
    }
}

// ---------------------------------------------------------------------------
// Problems, status line
// ---------------------------------------------------------------------------

function showProblems(problems) {
    draft.problems = problems;
    const doc = view.state.doc;
    const diagnostics = problems.map((problem) => {
        const line = doc.line(clamp(problem.line, 1, doc.lines));
        let from = Math.min(line.from + Math.max(0, problem.column - 1), line.to);
        if (from === line.to && from > line.from) from--;
        return { from, to: Math.min(line.to, from + 1), severity: 'error', message: problem.message, source: 'drafts editor' };
    });
    view.dispatch(setDiagnostics(view.state, diagnostics));
    els.problemCount.hidden = problems.length === 0;
    els.problemCount.textContent = `${problems.length} problem${problems.length === 1 ? '' : 's'}`;
}

// Same estimate as the post page (src/pages/blog/[...slug].astro)
function updateStats() {
    const body = view.state.doc.toString().replace(/^---\n[\s\S]*?\n---/, '');
    const prose = body
        .replace(/^(import|export)\s.*$/gm, '')
        .replace(/```[\s\S]*?```/g, '')
        .replace(/<[A-Z][\s\S]*?\/>/g, '')
        .replace(/<\/?[A-Z][^>]*>/g, '');
    const words = prose.split(/\s+/).filter(Boolean).length;
    els.wordCount.textContent = `${words.toLocaleString()} words · ${Math.max(1, Math.round(words / 200))} min read`;
}

function updateCursorPos() {
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    els.cursorPos.textContent = `Ln ${line.number}, Col ${head - line.from + 1}`;
}

let statsTimer = 0;
let lastEditAt = 0;
function onUpdate(update) {
    if (update.docChanged) {
        if (!update.transactions.some((tr) => tr.annotation(Transaction.remote))) {
            lastEditAt = performance.now();
            scheduleSave();
        }
        clearTimeout(statsTimer);
        statsTimer = setTimeout(updateStats, 300);
    }
    if (update.docChanged || update.selectionSet) {
        updateCursorPos();
        const fromUser = update.transactions.some((tr) => tr.isUserEvent('select') || tr.isUserEvent('input') || tr.isUserEvent('delete'));
        scheduleHighlight(fromUser);
        rememberPosition();
    }
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

function showBanner(message, tone, actions = []) {
    const text = document.createElement('span');
    text.textContent = message;
    const buttons = document.createElement('div');
    buttons.className = 'banner-actions';
    for (const action of actions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn';
        button.textContent = action.label;
        button.addEventListener('click', action.run);
        buttons.append(button);
    }
    els.banner.replaceChildren(text, buttons);
    els.banner.dataset.tone = tone;
    els.banner.hidden = false;
}

function hideBanner() {
    els.banner.hidden = true;
    els.banner.replaceChildren();
}

// ---------------------------------------------------------------------------
// Editing commands
// ---------------------------------------------------------------------------

function toggleWrap(view, mark) {
    if (view.state.selection.main.empty) enterInsertMode(view);
    const { state } = view;
    view.dispatch(state.changeByRange((range) => {
        const before = state.sliceDoc(Math.max(0, range.from - mark.length), range.from);
        const after = state.sliceDoc(range.to, range.to + mark.length);
        if (before === mark && after === mark) {
            return {
                changes: [{ from: range.from - mark.length, to: range.from }, { from: range.to, to: range.to + mark.length }],
                range: EditorSelection.range(range.from - mark.length, range.to - mark.length)
            };
        }
        return {
            changes: [{ from: range.from, insert: mark }, { from: range.to, insert: mark }],
            range: EditorSelection.range(range.from + mark.length, range.to + mark.length)
        };
    }), { userEvent: 'input.format' });
    view.focus();
    return true;
}

function insertLink(view) {
    enterInsertMode(view);
    const { state } = view;
    view.dispatch(state.changeByRange((range) => {
        const text = state.sliceDoc(range.from, range.to);
        if (/^https?:\/\/\S+$/.test(text)) {
            return {
                changes: { from: range.from, to: range.to, insert: `[](${text})` },
                range: EditorSelection.cursor(range.from + 1)
            };
        }
        const urlFrom = range.from + text.length + 3;
        return {
            changes: { from: range.from, to: range.to, insert: `[${text}](url)` },
            range: text ? EditorSelection.range(urlFrom, urlFrom + 3) : EditorSelection.cursor(range.from + 1)
        };
    }), { userEvent: 'input.format' });
    view.focus();
    return true;
}

// Adds [^n] at the cursor and its definition at the end, then moves there.
// Ctrl+U (undo selection) jumps back; in vim mode, where insert-mode Ctrl+U
// deletes the line, the jump goes on vim's jump list for Esc then Ctrl+O.
function insertFootnote(view) {
    enterInsertMode(view);
    const { state } = view;
    const text = state.doc.toString();
    const used = new Set([...text.matchAll(/\[\^([^\]\s]+)\]/g)].map((m) => m[1]));
    let n = 1;
    while (used.has(String(n))) n++;
    const ref = `[^${n}]`;
    const at = state.selection.main.to;
    const end = state.doc.length;
    const definition = `${text.endsWith('\n') ? '' : '\n'}\n${ref}: `;
    const cursor = end + ref.length + definition.length;
    view.dispatch({
        changes: [{ from: at, insert: ref }, { from: end, insert: definition }],
        selection: EditorSelection.cursor(cursor),
        scrollIntoView: true,
        userEvent: 'input.footnote'
    });
    view.focus();
    const cm = getCM(view);
    if (cm?.state.vim) {
        Vim.getVimGlobalState_().jumpList.add(cm, cm.posFromIndex(at + ref.length), cm.posFromIndex(cursor));
        flash('footnote added at the end · Esc then Ctrl+O jumps back');
    } else {
        flash('footnote added at the end · Ctrl+U jumps back');
    }
    return true;
}

// Adds `import X from '@/components/blog/X.astro';` for any missing names.
function ensureImports(view, names) {
    if (draft.ext !== '.mdx' || !names?.length) return;
    const text = view.state.doc.toString();
    const missing = names.filter((name) => !new RegExp(`^import\\s+(?:${name}\\b|\\{[^}]*\\b${name}\\b)`, 'm').test(text));
    if (!missing.length) return;
    const lines = missing.map((name) => `import ${name} from '@/components/blog/${name}.astro';`).join('\n');
    const imports = [...text.matchAll(/^import\s.*$/gm)];
    let from;
    let insert;
    if (imports.length) {
        const last = imports[imports.length - 1];
        from = last.index + last[0].length;
        insert = `\n${lines}`;
    } else {
        const frontMatter = /^---\n[\s\S]*?\n---[^\n]*\n?/.exec(text);
        from = frontMatter ? frontMatter[0].length : 0;
        insert = frontMatter ? `\n${lines}\n` : `${lines}\n\n`;
    }
    view.dispatch({ changes: { from, insert }, userEvent: 'input.import' });
    flash(`added import for ${missing.join(', ')}`);
}

// Inserts a snippet template (${field} placeholders, Tab to move between
// them). Block templates get blank lines around them.
function applyTemplate(view, template, from, to, { block = false } = {}) {
    let text = template;
    if (block) {
        const { doc } = view.state;
        const startLine = doc.lineAt(from);
        const endLine = doc.lineAt(to);
        if (doc.sliceString(startLine.from, from).trim()) text = `\n\n${text}`;
        else if (startLine.number > 1 && doc.line(startLine.number - 1).text.trim()) text = `\n${text}`;
        if (doc.sliceString(to, endLine.to).trim()) text = `${text}\n\n`;
        else if (endLine.number < doc.lines && doc.line(endLine.number + 1).text.trim()) text = `${text}\n`;
    }
    snippet(text)(view, null, from, to);
    view.focus();
}

function insertSnippet(view, item) {
    if (item.imports?.length && draft.ext !== '.mdx') {
        flash('components need an .mdx draft');
        return;
    }
    enterInsertMode(view);
    ensureImports(view, item.imports);
    const { from, to } = view.state.selection.main;
    applyTemplate(view, item.template, from, to, { block: item.block });
}

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

const SNIPPETS = [
    { group: 'Text', label: 'Footnote', keys: 'Ctrl+Shift+F', run: insertFootnote },
    { group: 'Text', label: 'Image', keys: 'or paste', run: () => els.imageInput.click() },
    { group: 'Text', label: 'Section heading', template: '## ${Heading}', block: true },
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

const snippetFor = (name) => SNIPPETS.find((item) => item.imports?.[0] === name);

function componentItem(name) {
    return snippetFor(name) ?? { label: name, imports: [name], template: `<${name} \${} />`, block: true };
}

// ---------------------------------------------------------------------------
// Completions: [^footnote] labels and <Component> names
// ---------------------------------------------------------------------------

function footnoteCompletions(context) {
    const match = context.matchBefore(/\[\^[^\]\s]*/);
    if (!match) return null;
    const definitions = new Map();
    for (const m of context.state.doc.toString().matchAll(/^\[\^([^\]\s]+)\]:\s*(.*)$/gm)) {
        definitions.set(m[1], m[2]);
    }
    return {
        from: match.from + 2,
        validFor: /^[^\]\s]*$/,
        options: [...definitions].map(([label, text]) => ({
            label,
            detail: text.length > 50 ? `${text.slice(0, 50)}…` : text,
            apply: (view, _completion, from, to) => {
                const close = view.state.sliceDoc(to, to + 1) === ']' ? '' : ']';
                view.dispatch({
                    changes: { from, to, insert: label + close },
                    selection: EditorSelection.cursor(from + label.length + 1)
                });
            }
        }))
    };
}

function componentCompletions(context) {
    if (draft.ext !== '.mdx') return null;
    const match = context.matchBefore(/<[A-Z]\w*/);
    if (!match) return null;
    return {
        from: match.from + 1,
        validFor: /^[A-Z]?\w*$/,
        options: components.map((name) => ({
            label: name,
            type: 'class',
            detail: snippetFor(name) ? snippetFor(name).label.toLowerCase() : 'component',
            apply: (view, _completion, from, to) => {
                const item = componentItem(name);
                ensureImports(view, item.imports);
                // The import may have shifted the typed "<Name"
                const head = view.state.selection.main.head;
                const start = head - (to - from) - 1;
                applyTemplate(view, item.template, start, head, { block: false });
            }
        }))
    };
}

// ---------------------------------------------------------------------------
// Images: paste, drop, or pick, saved under public/assets/blog/<slug>/
// ---------------------------------------------------------------------------

const imageName = (file) => {
    if (file.name && file.name !== 'image.png') return file.name;
    const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    return `pasted-${stamp}.${(file.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')}`;
};

async function uploadImages(files, pos) {
    const slug = draft.slug;
    const urls = [];
    for (const file of files) {
        flash(`uploading ${file.name || 'image'}…`, 10000);
        const res = await fetch(`/edit/api/assets/${slug}`, {
            method: 'POST',
            headers: {
                'X-Drafts-Editor': '1',
                'X-File-Name': encodeURIComponent(imageName(file)),
                'Content-Type': file.type || 'application/octet-stream'
            },
            body: file
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            showBanner(data.error ?? `Upload failed (HTTP ${res.status}).`, 'warn', [{ label: 'dismiss', run: hideBanner }]);
            continue;
        }
        urls.push(data.url);
    }
    if (!urls.length || slug !== draft.slug) return;
    enterInsertMode(view);
    const at = clamp(pos, 0, view.state.doc.length);
    if (urls.length === 1) {
        applyTemplate(view, `![\${Describe the image}](${urls[0]})`, at, at, { block: true });
    } else {
        applyTemplate(view, urls.map((url) => `![](${url})`).join('\n\n'), at, at, { block: true });
    }
    flash(`saved to public/assets/blog/${slug}/`);
}

const imagesIn = (list) => [...(list ?? [])].filter((file) => file.type.startsWith('image/'));

function onPaste(event, view) {
    const images = imagesIn(event.clipboardData?.files);
    if (images.length) {
        event.preventDefault();
        uploadImages(images, view.state.selection.main.head);
        return true;
    }
    // Pasting a URL over selected text makes a link
    const pasted = event.clipboardData?.getData('text/plain')?.trim() ?? '';
    const range = view.state.selection.main;
    const selected = view.state.sliceDoc(range.from, range.to);
    if (!range.empty && /^https?:\/\/\S+$/.test(pasted) && !selected.includes('\n') && !/^https?:\/\//.test(selected)) {
        event.preventDefault();
        view.dispatch({ changes: { from: range.from, to: range.to, insert: `[${selected}](${pasted})` }, userEvent: 'input.paste' });
        return true;
    }
    return false;
}

function onDrop(event, view) {
    const images = imagesIn(event.dataTransfer?.files);
    if (!images.length) return false;
    event.preventDefault();
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
    uploadImages(images, pos);
    return true;
}

// ---------------------------------------------------------------------------
// The editor view
// ---------------------------------------------------------------------------

let activePane = 'editor';

// Vim keys, on unless the "vim" checkbox is cleared. vim() must come before
// every other keymap, so it is the first extension. :w saves at once.
const vimMode = new Compartment();
const vimWanted = () => store.get('vim', true);
const vimExtension = () => (vimWanted() ? vim({ status: true }) : []);
Vim.defineEx('write', 'w', () => { flushSave(); });
Vim.defineEx('wq', 'wq', () => { flushSave(); });
Vim.defineEx('xit', 'x', () => { flushSave(); });

// Snippets, footnotes and links leave the cursor where you type next, so in
// vim mode they switch to insert mode first, keeping the selection (a
// selection made outside insert mode would turn into visual mode instead).
function enterInsertMode(view) {
    const cm = getCM(view);
    const state = cm?.state.vim;
    if (!state || state.insertMode) return;
    const selection = view.state.selection;
    if (state.visualMode) Vim.exitVisualMode(cm, false);
    Vim.handleKey(cm, 'i', 'mapping');
    if (!view.state.selection.eq(selection)) view.dispatch({ selection });
}

const editorKeys = [
    { key: 'Mod-s', run: () => { flushSave(); return true; }, preventDefault: true },
    { key: 'Mod-b', run: (v) => toggleWrap(v, '**') },
    { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
    { key: 'Mod-e', run: (v) => toggleWrap(v, '`') },
    { key: 'Mod-k', run: insertLink, preventDefault: true },
    { key: 'Mod-Shift-f', run: insertFootnote, preventDefault: true },
    { key: 'F8', run: nextDiagnostic }
];

const extensions = () => [
    vimMode.of(vimExtension()),
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    undoHistory(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    indentUnit.of('\t'),
    EditorState.tabSize.of(4),
    bracketMatching(),
    autocompletion({ override: [footnoteCompletions, componentCompletions], icons: false }),
    highlightActiveLine(),
    highlightSelectionMatches(),
    search({ top: true }),
    lintGutter(),
    yamlFrontmatter({ content: markdown({ base: markdownLanguage }) }),
    syntaxHighlighting(highlightStyle),
    mdxHighlighter,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ spellcheck: 'true', autocorrect: 'off', autocapitalize: 'off' }),
    theme,
    keymap.of([
        ...editorKeys,
        ...completionKeymap,
        ...searchKeymap,
        ...historyKeymap,
        ...foldKeymap,
        ...lintKeymap,
        ...defaultKeymap,
        indentWithTab
    ]),
    EditorView.updateListener.of(onUpdate),
    EditorView.domEventHandlers({
        paste: onPaste,
        drop: onDrop
    })
];

const view = new EditorView({
    parent: els.editor,
    state: EditorState.create({ doc: '', extensions: extensions() })
});

for (const type of ['pointerenter', 'pointerdown', 'wheel', 'touchstart', 'keydown']) {
    els.editor.addEventListener(type, () => { activePane = 'editor'; }, { capture: true, passive: true });
}

// Top edge of the editor viewport, as a fractional 1-based line number
function editorTopLine() {
    const top = view.scrollDOM.getBoundingClientRect().top - view.documentTop;
    const block = view.lineBlockAtHeight(Math.max(0, top));
    const line = view.state.doc.lineAt(block.from).number;
    return line + clamp((top - block.top) / Math.max(1, block.height), 0, 0.999);
}

// Scrolls made here (sync, restoring position) must not echo back as if
// the reader had scrolled that pane.
let quietEditorUntil = 0;
let quietPreviewUntil = 0;

function scrollEditorToLine(lineFrac, offset = 0) {
    const doc = view.state.doc;
    const n = clamp(Math.floor(lineFrac), 1, doc.lines);
    const block = view.lineBlockAt(doc.line(n).from);
    const target = block.top + (lineFrac - n) * block.height;
    const visibleTop = view.scrollDOM.getBoundingClientRect().top - view.documentTop;
    quietEditorUntil = performance.now() + 150;
    view.scrollDOM.scrollTop += target - visibleTop - offset;
}

let positionTimer = 0;
function rememberPosition() {
    if (!draft.slug) return;
    clearTimeout(positionTimer);
    const slug = draft.slug;
    positionTimer = setTimeout(() => {
        if (slug !== draft.slug) return;
        const { anchor, head } = view.state.selection.main;
        store.set(`pos:${slug}`, { anchor, head, line: editorTopLine() });
    }, 400);
}
view.scrollDOM.addEventListener('scroll', rememberPosition, { passive: true });

// ---------------------------------------------------------------------------
// Preview: two iframes, swapped when a new render is ready
// ---------------------------------------------------------------------------

const frames = [...document.querySelectorAll('.frame')];
let front = frames[0];
let back = frames[1];
const prepared = new WeakSet();
const pointCache = new WeakMap();
let previewToken = 0;
let previewBusy = false;
let previewAgain = false;
let lastPreviewInput = 0;

// Injected into each preview document (post pages allow inline styles)
const PREVIEW_CSS = `
html { scroll-behavior: auto !important; }
.drafts-editor-active { outline: 1px dashed #ebbcba; outline-offset: 6px; border-radius: 2px; }
.reveal-hidden, .reveal-visible { opacity: 1 !important; transform: none !important; transition: none !important; }
.reveal-visible li { opacity: 1 !important; animation: none !important; }
`;

// For .md drafts Astro renders the body without front matter, so its line
// numbers start after it; .mdx keeps the file's numbering.
function lineOffset() {
    if (draft.ext !== '.md') return 0;
    const text = view.state.doc.toString();
    const frontMatter = /^---\n[\s\S]*?\n---[^\n]*\n/.exec(text);
    if (!frontMatter) return 0;
    const rest = text.slice(frontMatter[0].length);
    const leading = /^(\s*\n)*/.exec(rest)[0];
    return (frontMatter[0] + leading).split('\n').length - 1;
}

const sourceLines = (el) => {
    const offset = lineOffset();
    const start = Number(el.dataset.line) + offset;
    return { start, end: Number(el.dataset.lineEnd || el.dataset.line) + offset };
};

// Whether an element is laid out (not inside a closed <details>)
function isShown(el) {
    const closed = el.closest('details:not([open])');
    if (closed && !closed.querySelector(':scope > summary')?.contains(el)) return false;
    return el.getClientRects().length > 0;
}

// (line, y) pairs from every tagged block, non-decreasing in both
function previewPoints(frame) {
    if (pointCache.has(frame)) return pointCache.get(frame);
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    if (!doc?.body || !prepared.has(frame)) return null;
    const points = [{ line: 1, y: 0 }];
    for (const el of doc.querySelectorAll('[data-line]')) {
        if (!isShown(el)) continue;
        const rect = el.getBoundingClientRect();
        if (!rect.height) continue;
        const { start, end } = sourceLines(el);
        const top = rect.top + win.scrollY;
        points.push({ line: start, y: top }, { line: end + 1, y: top + rect.height });
    }
    points.push({ line: view.state.doc.lines + 1, y: doc.documentElement.scrollHeight });
    points.sort((a, b) => a.line - b.line || a.y - b.y);
    const monotonic = [];
    for (const point of points) {
        const last = monotonic[monotonic.length - 1];
        if (last && point.y < last.y) continue;
        monotonic.push(point);
    }
    pointCache.set(frame, monotonic);
    return monotonic;
}

const invalidatePoints = (frame) => pointCache.delete(frame);

function interpolate(points, key, value, other) {
    if (!points?.length) return 0;
    if (value <= points[0][key]) return points[0][other];
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (value <= b[key]) {
            const span = b[key] - a[key];
            return span <= 0 ? b[other] : a[other] + ((value - a[key]) / span) * (b[other] - a[other]);
        }
    }
    return points[points.length - 1][other];
}

const yForLine = (frame, line) => interpolate(previewPoints(frame), 'line', line, 'y');
const lineAtTop = (frame) => interpolate(previewPoints(frame), 'y', frame.contentWindow.scrollY, 'line');

function scrollPreview(frame, y) {
    quietPreviewUntil = performance.now() + 150;
    frame.contentWindow.scrollTo({ top: y, behavior: 'instant' });
}

let syncRequest = 0;
view.scrollDOM.addEventListener('scroll', () => {
    if (activePane !== 'editor' || !els.sync.checked || !prepared.has(front)) return;
    if (performance.now() < quietEditorUntil) return;
    cancelAnimationFrame(syncRequest);
    syncRequest = requestAnimationFrame(() => scrollPreview(front, yForLine(front, editorTopLine())));
}, { passive: true });

function onPreviewScroll(frame) {
    if (frame !== front || activePane !== 'preview' || !els.sync.checked) return;
    if (performance.now() < quietPreviewUntil) return;
    cancelAnimationFrame(syncRequest);
    syncRequest = requestAnimationFrame(() => scrollEditorToLine(lineAtTop(frame)));
}

// Swapping iframes under a resting pointer fires a synthetic pointerenter
let lastSwap = 0;
els.previewPane.addEventListener('pointerenter', () => {
    if (performance.now() - lastSwap > 500) activePane = 'preview';
});

// Outline the preview block that holds the cursor
let highlightRequest = 0;
let activeElement = null;
function scheduleHighlight(fromUser = false) {
    cancelAnimationFrame(highlightRequest);
    highlightRequest = requestAnimationFrame(() => highlightActive(fromUser));
}

function highlightActive(fromUser = false) {
    activeElement?.classList.remove('drafts-editor-active');
    activeElement = null;
    if (!prepared.has(front)) return;
    const line = view.state.doc.lineAt(view.state.selection.main.head).number;
    let best = null;
    let bestSpan = Infinity;
    for (const el of front.contentDocument.querySelectorAll('[data-line]')) {
        const { start, end } = sourceLines(el);
        if (line < start || line > end) continue;
        const span = end - start;
        if (span <= bestSpan) {
            best = el;
            bestSpan = span;
        }
    }
    if (!best) return;
    best.classList.add('drafts-editor-active');
    activeElement = best;
    if (!fromUser || activePane !== 'editor') return;
    // Typing inside a collapsed Fold or trace block opens it
    for (let d = best.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
        d.open = true;
    }
    const rect = best.getBoundingClientRect();
    const height = front.contentWindow.innerHeight;
    if (rect.bottom < 0 || rect.top > height) {
        scrollPreview(front, rect.top + front.contentWindow.scrollY - height / 3);
    }
}

// Double-click in the preview: put the cursor on that word in the source
function jumpToSource(frame, event) {
    const doc = frame.contentDocument;
    const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
    if (!target) return;
    const selection = doc.getSelection();
    const word = selection?.toString().trim() ?? '';
    const block = target.closest('[data-line]');
    let range = null;
    let anchorEl = block;
    if (block) {
        const { start, end } = sourceLines(block);
        range = locateWord(start, end, word, textRatio(block, selection));
    } else if (target.closest('.post-header')) {
        range = locateFrontMatter(target);
        anchorEl = target;
    } else if (target.closest('.post-content')) {
        range = locateComponent(doc, target);
        anchorEl = target.closest('figure, details, .tex, div') ?? target;
    }
    if (!range) return;
    if (els.panes.dataset.view === 'preview') setView('split');
    const offset = anchorEl ? anchorEl.getBoundingClientRect().top : 0;
    activePane = 'preview';
    view.dispatch({ selection: EditorSelection.range(range.from, range.to), userEvent: 'select.jump' });
    view.focus();
    requestAnimationFrame(() => {
        scrollEditorToLine(view.state.doc.lineAt(range.from).number, clamp(offset, 40, view.scrollDOM.clientHeight - 80));
        activePane = 'preview';
    });
}

function textRatio(el, selection) {
    try {
        const range = selection.getRangeAt(0);
        const before = el.ownerDocument.createRange();
        before.selectNodeContents(el);
        before.setEnd(range.startContainer, range.startOffset);
        return before.toString().length / Math.max(1, el.textContent.length);
    } catch {
        return 0;
    }
}

const firstText = (line) => line.from + (/^\s*/.exec(line.text)?.[0].length ?? 0);

function locateWord(start, end, word, ratio) {
    const doc = view.state.doc;
    const first = doc.line(clamp(start, 1, doc.lines));
    const last = doc.line(clamp(end, first.number, doc.lines));
    const at = firstText(first);
    if (!word) return { from: at, to: at };
    // The preview has curly quotes; the source has straight ones
    const plain = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    const text = plain(doc.sliceString(first.from, last.to));
    const needle = plain(word);
    const hits = [];
    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) hits.push(i);
    if (!hits.length) return { from: at, to: at };
    const goal = ratio * text.length;
    const best = hits.reduce((a, b) => (Math.abs(b - goal) < Math.abs(a - goal) ? b : a));
    return { from: first.from + best, to: first.from + best + needle.length };
}

function locateFrontMatter(target) {
    const key = target.closest('h1') ? 'title'
        : target.closest('.chip-tag') ? 'tags'
        : target.closest('.chip:not(.chip-draft)') ? 'category'
        : target.closest('.post-date') ? 'date'
        : null;
    if (!key) return null;
    const doc = view.state.doc;
    for (let n = 1; n <= Math.min(doc.lines, 40); n++) {
        const line = doc.line(n);
        if (line.text.startsWith(`${key}:`)) {
            const from = line.from + key.length + 1 + (/^\s*/.exec(line.text.slice(key.length + 1))[0].length);
            return { from, to: line.to };
        }
    }
    return null;
}

// Components carry no line numbers: find the tag between the tagged blocks
// around it.
function locateComponent(doc, target) {
    let previous = null;
    let next = null;
    for (const el of doc.querySelectorAll('[data-line]')) {
        const position = el.compareDocumentPosition(target);
        if (position & Node.DOCUMENT_POSITION_FOLLOWING) previous = el;
        else if (position & Node.DOCUMENT_POSITION_PRECEDING) {
            next = el;
            break;
        }
    }
    const source = view.state.doc;
    const lo = previous ? sourceLines(previous).end + 1 : 1;
    const hi = next ? sourceLines(next).start - 1 : source.lines;
    for (let n = clamp(lo, 1, source.lines); n <= clamp(hi, 1, source.lines); n++) {
        const line = source.line(n);
        if (/^\s*<[A-Za-z]/.test(line.text)) return { from: firstText(line), to: firstText(line) };
    }
    const line = source.line(clamp(lo, 1, source.lines));
    return { from: firstText(line), to: firstText(line) };
}

// Links open in a new tab, so the preview stays on the draft
function interceptLinks(event) {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const url = new URL(link.getAttribute('href'), link.ownerDocument.baseURI);
    const here = new URL(link.ownerDocument.URL);
    if (url.origin === here.origin && url.pathname === here.pathname && url.hash) return;
    event.preventDefault();
    event.stopPropagation();
    window.open(url.href, '_blank', 'noopener');
}

function prepareFrame(frame) {
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    const style = doc.createElement('style');
    style.textContent = PREVIEW_CSS;
    doc.head.append(style);
    const markInput = () => {
        activePane = 'preview';
        lastPreviewInput = performance.now();
    };
    for (const type of ['wheel', 'pointerdown', 'keydown', 'touchstart']) {
        doc.addEventListener(type, markInput, { capture: true, passive: true });
    }
    doc.addEventListener('dblclick', (event) => jumpToSource(frame, event));
    doc.addEventListener('click', interceptLinks, true);
    doc.addEventListener('toggle', () => invalidatePoints(frame), true);
    win.addEventListener('scroll', () => onPreviewScroll(frame), { passive: true });
    win.addEventListener('resize', () => invalidatePoints(frame));
    new ResizeObserver(() => invalidatePoints(frame)).observe(doc.body);
    prepared.add(frame);
}

function waitForLoad(frame, token, ms) {
    return new Promise((resolve) => {
        const finish = (ok) => {
            clearTimeout(timer);
            frame.removeEventListener('load', onLoad);
            resolve(ok);
        };
        const onLoad = () => {
            try {
                if (frame.contentWindow.location.search.includes(`r=${token}`)) finish(true);
            } catch {
                finish(false);
            }
        };
        const timer = setTimeout(() => finish(false), ms);
        frame.addEventListener('load', onLoad);
    });
}

// Fonts and MathJax change heights; let them land before measuring
async function settle(frame) {
    const win = frame.contentWindow;
    const waits = [win.document.fonts?.ready, win.MathJax?.startup?.promise].filter(Boolean);
    await Promise.race([Promise.all(waits), sleep(2500)]);
}

// Keep the reader's place through late layout shifts after a swap
function holdPosition(frame, target) {
    const started = performance.now();
    const observer = new ResizeObserver(() => {
        if (frame !== front || lastPreviewInput > started || performance.now() - started > 2000) {
            observer.disconnect();
            return;
        }
        invalidatePoints(frame);
        scrollPreview(frame, target());
    });
    observer.observe(frame.contentDocument.body);
    setTimeout(() => observer.disconnect(), 2100);
}

function swapFrames() {
    lastSwap = performance.now();
    [front, back] = [back, front];
    front.classList.add('is-front');
    back.classList.remove('is-front');
    front.title = 'Preview';
    back.title = 'Preview, loading';
    front.removeAttribute('aria-hidden');
    front.removeAttribute('tabindex');
    back.setAttribute('aria-hidden', 'true');
    back.tabIndex = -1;
    prepared.delete(back);
    invalidatePoints(back);
    back.src = 'about:blank';
}

async function renderInto(frame) {
    const token = ++previewToken;
    const slug = draft.slug;
    prepared.delete(frame);
    invalidatePoints(frame);
    frame.src = `/edit/preview/${slug}/?r=${token}`;
    const loaded = await waitForLoad(frame, token, 30000);
    if (!loaded || slug !== draft.slug || token !== previewToken) return;
    const marker = frame.contentDocument.querySelector('meta[name="drafts-editor-error"]');
    if (marker) {
        showPreviewError(JSON.parse(marker.content));
        return;
    }
    await settle(frame);
    if (slug !== draft.slug || token !== previewToken) return;
    hidePreviewError();
    prepareFrame(frame);
    // Land where the reader is looking. When the editor leads (or the old
    // preview shows another draft): the cursor's text at the cursor's height,
    // with any fold around it open, or else the editor's top line. Otherwise
    // the old preview's top line.
    const editorLeads = !prepared.has(front) || (els.sync.checked && activePane === 'editor');
    let target;
    if (editorLeads) {
        const cursor = cursorAnchor();
        if (cursor) {
            openFoldsAround(frame, Math.floor(cursor.line));
            target = () => Math.max(0, yForLine(frame, cursor.line) - cursor.offset);
        } else {
            const line = editorTopLine();
            target = () => yForLine(frame, line);
        }
    } else {
        const line = lineAtTop(front);
        target = () => yForLine(frame, line);
    }
    scrollPreview(frame, target());
    swapFrames();
    holdPosition(front, target);
    highlightActive();
}

// Where the cursor sits, when it is on screen: its fractional line and its
// distance from the top of the editor viewport.
function cursorAnchor() {
    const head = view.state.selection.main.head;
    const coords = view.coordsAtPos(head);
    const rect = view.scrollDOM.getBoundingClientRect();
    if (!coords || coords.top < rect.top || coords.bottom > rect.bottom) return null;
    const block = view.lineBlockAt(head);
    const docY = coords.top - view.documentTop;
    const fraction = clamp((docY - block.top) / Math.max(1, block.height), 0, 0.999);
    return { line: view.state.doc.lineAt(head).number + fraction, offset: coords.top - rect.top };
}

function openFoldsAround(frame, line) {
    let opened = false;
    for (const el of frame.contentDocument.querySelectorAll('[data-line]')) {
        const { start, end } = sourceLines(el);
        if (line < start || line > end) continue;
        for (let d = el.closest('details:not([open])'); d; d = d.parentElement?.closest('details:not([open])')) {
            d.open = true;
            opened = true;
        }
    }
    if (opened) invalidatePoints(frame);
}

async function refreshPreview() {
    if (!draft.slug) return;
    if (previewBusy) {
        previewAgain = true;
        return;
    }
    previewBusy = true;
    const busyTimer = setTimeout(() => { els.previewBusy.hidden = false; }, prepared.has(front) ? 400 : 0);
    try {
        do {
            previewAgain = false;
            await renderInto(back);
        } while (previewAgain);
    } finally {
        previewBusy = false;
        clearTimeout(busyTimer);
        els.previewBusy.hidden = true;
    }
}

// The front frame navigated away (a vim `h`/`l` key, a form): bring it back
for (const frame of frames) {
    frame.addEventListener('load', () => {
        if (frame !== front || !draft.slug) return;
        let href = 'cross-origin';
        try {
            href = frame.contentWindow.location.href;
        } catch {
            // Cross-origin: certainly not the preview
        }
        if (href !== 'about:blank' && !href.includes('/edit/preview/')) refreshPreview();
    });
}

let previewErrorLine = null;
let previewErrorTimer = 0;
const ERROR_PATIENCE = 1500;
function showPreviewError(error) {
    // Half-typed tags break the render all the time; say so only once the
    // typing pauses (the old preview stays up meanwhile)
    clearTimeout(previewErrorTimer);
    const wait = lastEditAt + ERROR_PATIENCE - performance.now();
    if (wait > 0 && prepared.has(front)) {
        previewErrorTimer = setTimeout(() => showPreviewError(error), wait);
        return;
    }
    const parts = [error.title, error.message, error.hint && `Hint: ${error.hint}`]
        .filter((part, i, all) => part && all.indexOf(part) === i);
    // The editor's own parse is the clearer message when Astro gave no place
    const own = draft.problems[0];
    if (own && !error.loc?.line) parts.unshift(`Line ${own.line}: ${own.message}`);
    const loc = error.loc;
    const ownFile = loc?.file && draft.file && loc.file.replace(/\\/g, '/').endsWith(draft.file.replace(/^drafts\//, '/'));
    if (loc?.file && !ownFile) parts.push(`in ${loc.file}${loc.line ? `:${loc.line}` : ''}`);
    els.previewErrorTitle.textContent = prepared.has(front)
        ? "Preview paused: this version doesn't render. Showing the last one that did."
        : "Preview unavailable: this version doesn't render.";
    els.previewErrorText.textContent = parts.join('\n\n') || 'Render error. The dev server terminal has the details.';
    previewErrorLine = ownFile && loc.line ? loc.line : draft.problems[0]?.line ?? null;
    els.previewErrorJump.hidden = previewErrorLine == null;
    els.previewError.hidden = false;
}

function hidePreviewError() {
    clearTimeout(previewErrorTimer);
    els.previewError.hidden = true;
}

els.previewErrorJump.addEventListener('click', () => {
    if (previewErrorLine == null) return;
    const line = view.state.doc.line(clamp(previewErrorLine, 1, view.state.doc.lines));
    view.dispatch({ selection: EditorSelection.cursor(line.from), effects: EditorView.scrollIntoView(line.from, { y: 'center' }) });
    view.focus();
});

// ---------------------------------------------------------------------------
// Drafts: list, open, create
// ---------------------------------------------------------------------------

async function loadDraftList() {
    const { status, data } = await api('drafts');
    if (status !== 200) {
        showBanner(data.error ?? `Couldn't list drafts (HTTP ${status}).`, 'warn');
        return [];
    }
    drafts = data.drafts;
    els.select.replaceChildren(...drafts.map((d) => {
        const option = new Option(d.title, d.slug);
        option.title = d.file;
        return option;
    }));
    if (draft.slug) els.select.value = draft.slug;
    return drafts;
}

let listTimer = 0;
const refreshDraftListSoon = () => {
    clearTimeout(listTimer);
    listTimer = setTimeout(loadDraftList, 500);
};

async function openDraft(slug, { push = true } = {}) {
    if (draft.slug) {
        await flushSave();
        if (draft.conflict) {
            els.select.value = draft.slug;
            flash('resolve the conflict first');
            return false;
        }
    }
    const { status, data } = await api(`drafts/${slug}`);
    if (status !== 200) {
        showBanner(data.error ?? `Couldn't open ${slug}.`, 'warn');
        els.select.value = draft.slug ?? '';
        return false;
    }
    hideBanner();
    hidePreviewError();
    const text = normalize(data.content);
    Object.assign(draft, {
        slug,
        ext: data.ext,
        file: data.file,
        savedText: text,
        savedHash: data.hash,
        conflict: null,
        problems: [],
        again: false,
        pendingDiskCheck: false
    });
    const saved = store.get(`pos:${slug}`, null);
    const anchor = clamp(saved?.anchor ?? 0, 0, text.length);
    const head = clamp(saved?.head ?? 0, 0, text.length);
    view.setState(EditorState.create({
        doc: text,
        selection: EditorSelection.range(anchor, head),
        extensions: extensions()
    }));
    // Let CodeMirror scroll once it has measured the new document; setting
    // scrollTop before that measure gets reset to the top
    if (saved?.line) {
        const line = view.state.doc.line(clamp(Math.floor(saved.line), 1, view.state.doc.lines));
        view.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'start' }) });
    }
    const title = drafts.find((d) => d.slug === slug)?.title ?? slug;
    document.title = `${title} · drafts editor`;
    els.select.value = slug;
    els.openPost.href = `/blog/${slug}/`;
    els.filePath.textContent = data.file;
    if (push) window.history.pushState({ slug }, '', `/edit/${slug}`);
    else window.history.replaceState({ slug }, '', `/edit/${slug}`);
    store.set('last', slug);
    showProblems(data.problems ?? []);
    updateStats();
    updateCursorPos();
    setStatus('saved', 'saved');
    activePane = 'editor';
    prepared.delete(front);
    refreshPreview();
    view.focus();
    offerBackup(slug, text);
    return true;
}

// A save that never reached the disk (dev server down) is kept in this
// browser; offer it back.
function offerBackup(slug, diskText) {
    const backup = store.get(`backup:${slug}`, null);
    if (!backup || backup.text === diskText) {
        store.set(`backup:${slug}`, undefined);
        return;
    }
    const when = new Date(backup.time).toLocaleString();
    showBanner(`This browser has edits to ${draft.file} from ${when} that never reached the disk.`, 'info', [
        {
            label: 'restore them',
            run: () => {
                hideBanner();
                replaceDoc(backup.text, { remote: false });
            }
        },
        {
            label: 'discard',
            run: () => {
                store.set(`backup:${slug}`, undefined);
                hideBanner();
            }
        }
    ]);
}

els.select.addEventListener('change', () => openDraft(els.select.value));

window.addEventListener('popstate', () => {
    const slug = location.pathname.replace(/^\/edit\/?/, '').replace(/\/$/, '');
    if (slug && slug !== draft.slug) openDraft(slug, { push: false });
});

const slugify = (text) => text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');

let slugEdited = false;
els.newButton.addEventListener('click', () => {
    els.newForm.reset();
    slugEdited = false;
    els.newError.hidden = true;
    els.newSlugPreview.textContent = 'my-post-title';
    els.newDialog.showModal();
    els.newTitle.focus();
});
els.newTitle.addEventListener('input', () => {
    if (slugEdited) return;
    els.newSlug.value = slugify(els.newTitle.value);
    els.newSlugPreview.textContent = els.newSlug.value || 'my-post-title';
});
els.newSlug.addEventListener('input', () => {
    slugEdited = true;
    els.newSlugPreview.textContent = els.newSlug.value || 'my-post-title';
});
els.newCancel.addEventListener('click', () => els.newDialog.close());
els.newForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(els.newForm);
    const { status, data } = await api('drafts', {
        method: 'POST',
        body: { slug: String(form.get('slug')), title: String(form.get('title')), format: String(form.get('format')) }
    });
    if (status !== 201) {
        els.newError.textContent = data.error ?? `Couldn't create the draft (HTTP ${status}).`;
        els.newError.hidden = false;
        return;
    }
    els.newDialog.close();
    await loadDraftList();
    openDraft(data.slug);
});

// ---------------------------------------------------------------------------
// Toolbar, insert menu, layout
// ---------------------------------------------------------------------------

const commands = {
    bold: () => toggleWrap(view, '**'),
    italic: () => toggleWrap(view, '*'),
    code: () => toggleWrap(view, '`'),
    link: () => insertLink(view),
    footnote: () => insertFootnote(view),
    image: () => els.imageInput.click()
};
for (const button of document.querySelectorAll('[data-cmd]')) {
    button.addEventListener('click', () => commands[button.dataset.cmd]());
}

els.imageInput.addEventListener('change', () => {
    const images = imagesIn(els.imageInput.files);
    if (images.length) uploadImages(images, view.state.selection.main.head);
    els.imageInput.value = '';
});

function buildInsertMenu() {
    const items = [...SNIPPETS];
    const covered = new Set(SNIPPETS.flatMap((item) => item.imports ?? []));
    for (const name of components) {
        if (!covered.has(name)) items.push({ ...componentItem(name), group: 'Other components' });
    }
    const children = [];
    let group = null;
    for (const item of items) {
        if (item.group !== group) {
            group = item.group;
            const heading = document.createElement('div');
            heading.className = 'menu-heading';
            heading.textContent = group;
            children.push(heading);
        }
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'menu-item';
        button.setAttribute('role', 'menuitem');
        button.tabIndex = -1;
        const label = document.createElement('span');
        label.textContent = item.label;
        button.append(label);
        const needsMdx = item.imports?.length && draft.ext !== '.mdx';
        if (item.keys || needsMdx) {
            const note = document.createElement('small');
            note.textContent = needsMdx ? 'mdx only' : item.keys;
            button.append(note);
        }
        button.disabled = Boolean(needsMdx);
        button.addEventListener('click', () => {
            closeInsertMenu();
            if (item.run) item.run(view);
            else insertSnippet(view, item);
        });
        children.push(button);
    }
    els.insertMenu.replaceChildren(...children);
}

function openInsertMenu() {
    buildInsertMenu();
    els.insertMenu.hidden = false;
    // Keep it on screen in narrow windows
    els.insertMenu.style.left = '';
    const overflow = els.insertMenu.getBoundingClientRect().right - (window.innerWidth - 8);
    if (overflow > 0) els.insertMenu.style.left = `${-overflow}px`;
    els.insertButton.setAttribute('aria-expanded', 'true');
    els.insertMenu.querySelector('.menu-item:not(:disabled)')?.focus();
}

function closeInsertMenu({ refocus = false } = {}) {
    if (els.insertMenu.hidden) return;
    els.insertMenu.hidden = true;
    els.insertButton.setAttribute('aria-expanded', 'false');
    if (refocus) els.insertButton.focus();
}

els.insertButton.addEventListener('click', () => {
    if (els.insertMenu.hidden) openInsertMenu();
    else closeInsertMenu();
});
els.insertMenu.addEventListener('keydown', (event) => {
    const items = [...els.insertMenu.querySelectorAll('.menu-item:not(:disabled)')];
    const index = items.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        items[(index + step + items.length) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        closeInsertMenu({ refocus: true });
    }
});
document.addEventListener('pointerdown', (event) => {
    if (!event.target.closest('.menu')) closeInsertMenu();
});

function setView(mode) {
    els.panes.dataset.view = mode;
    for (const button of document.querySelectorAll('[data-view]')) {
        button.setAttribute('aria-pressed', String(button.dataset.view === mode));
    }
    store.set('view', mode);
    invalidatePoints(front);
    view.requestMeasure();
}
for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => setView(button.dataset.view));
}

els.vim.checked = vimWanted();
els.vim.addEventListener('change', () => {
    store.set('vim', els.vim.checked);
    view.dispatch({ effects: vimMode.reconfigure(vimExtension()) });
    view.focus();
});

els.sync.checked = store.get('sync', true);
els.sync.addEventListener('change', () => {
    store.set('sync', els.sync.checked);
    if (els.sync.checked && prepared.has(front)) scrollPreview(front, yForLine(front, editorTopLine()));
});

const setSplit = (percent) => {
    const value = clamp(percent, 20, 80);
    els.panes.style.setProperty('--split', `${value}%`);
    store.set('split', value);
    invalidatePoints(front);
};
setSplit(store.get('split', 50));

els.divider.addEventListener('pointerdown', (event) => {
    if (getComputedStyle(els.divider).cursor !== 'col-resize') return;
    event.preventDefault();
    els.divider.setPointerCapture(event.pointerId);
    els.divider.classList.add('dragging');
    els.panes.classList.add('dragging');
    const move = (e) => {
        const rect = els.panes.getBoundingClientRect();
        setSplit(((e.clientX - rect.left) / rect.width) * 100);
    };
    const stop = () => {
        els.divider.classList.remove('dragging');
        els.panes.classList.remove('dragging');
        els.divider.removeEventListener('pointermove', move);
        els.divider.removeEventListener('pointerup', stop);
        els.divider.removeEventListener('pointercancel', stop);
    };
    els.divider.addEventListener('pointermove', move);
    els.divider.addEventListener('pointerup', stop);
    els.divider.addEventListener('pointercancel', stop);
});
els.divider.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    setSplit(store.get('split', 50) + (event.key === 'ArrowLeft' ? -2 : 2));
});

els.problemCount.addEventListener('click', () => {
    view.focus();
    nextDiagnostic(view);
});

// Ctrl+S anywhere on the page (the editor binds it too)
document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        flushSave();
    }
});

// Closing the tab inside the autosave delay: send the last edit with a
// keepalive request, keep a copy here in case it doesn't land, and only ask
// to stay when there is an unresolved conflict.
window.addEventListener('beforeunload', (event) => {
    if (!draft.slug) return;
    const text = view.state.doc.toString();
    if (text === draft.savedText && !currentSave) return;
    store.set(`backup:${draft.slug}`, { text, baseHash: draft.savedHash, time: Date.now() });
    if (draft.conflict) {
        event.preventDefault();
        return;
    }
    fetch(`/edit/api/drafts/${draft.slug}`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'X-Drafts-Editor': '1', 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text, baseHash: draft.savedHash })
    });
});

// ---------------------------------------------------------------------------
// Server events
// ---------------------------------------------------------------------------

function connectEvents() {
    const source = new EventSource('/edit/api/events');
    let lost = false;
    source.addEventListener('open', () => {
        if (!lost) return;
        lost = false;
        hideBanner();
        refreshPreview();
        checkDisk();
        loadDraftList();
    });
    source.addEventListener('error', () => {
        if (lost) return;
        lost = true;
        showBanner('Lost the dev server. Is `npm run dev` still running? Edits stay here and save once it is back.', 'warn');
    });
    source.addEventListener('reload', () => refreshPreview());
    source.addEventListener('file', (event) => {
        const { slug, hash } = JSON.parse(event.data);
        refreshDraftListSoon();
        if (slug !== draft.slug) return;
        if (hash === null) {
            showBanner(`${draft.file} was deleted or renamed on disk.`, 'warn');
            return;
        }
        if (hash === draft.savedHash) return;
        if (currentSave) draft.pendingDiskCheck = true;
        else checkDisk();
    });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function init() {
    setView(store.get('view', 'split'));
    const [list] = await Promise.all([
        loadDraftList(),
        api('components').then(({ data }) => { components = data.components ?? []; })
    ]);
    connectEvents();
    const fromUrl = location.pathname.replace(/^\/edit\/?/, '').replace(/\/$/, '');
    const last = store.get('last', null);
    const slug = [fromUrl, last, list[0]?.slug].find((s) => s && list.some((d) => d.slug === s));
    if (slug) {
        await openDraft(slug, { push: false });
        if (fromUrl && fromUrl !== slug) flash(`no draft named ${fromUrl}`);
    } else {
        setStatus('saved', '');
        showBanner('No drafts yet.', 'info', [{ label: 'start one', run: () => els.newButton.click() }]);
    }
}

init();
