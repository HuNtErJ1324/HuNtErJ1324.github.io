// Turn the blog's old giscus comments (GitHub Discussions in this repo) into a
// Comentario import file. README.md step 4 says where to upload it.
//
//   node comments-server/giscus-import.mjs giscus-import.json
//
// It writes the file itself because Windows PowerShell's `>` would save it as
// UTF-16, which Comentario can't read. Needs the GitHub CLI (gh), signed in. giscus titled each discussion with its
// term, `blog/<slug>/`, which is also the page-id Post.astro gives Comentario.
// Every comment becomes a name-only comment (Comentario's anonymous user, with
// the GitHub username as the author name), approved, with its original date and
// parent. Hidden (minimized) comments are left out, with their replies. Comentario's v3 import
// stores the HTML as given, so the text goes in escaped, as plain paragraphs.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const REPO = { owner: 'HuNtErJ1324', name: 'HuNtErJ1324.github.io' };
const CATEGORY = 'Announcements';
const TERM = /^blog\/[^/]+\/$/;
// Comentario's built-in anonymous user
const ANONYMOUS = '00000000-0000-0000-0000-000000000000';

// 20 discussions a page keeps the query under GitHub's 500,000-node limit
// (20 × 100 comments × 100 replies)
const QUERY = `query($owner: String!, $name: String!, $cursor: String) {
    repository(owner: $owner, name: $name) {
        discussions(first: 20, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            nodes {
                title
                category { name }
                comments(first: 100) {
                    pageInfo { hasNextPage }
                    nodes {
                        author { login }
                        createdAt
                        body
                        isMinimized
                        replies(first: 100) {
                            pageInfo { hasNextPage }
                            nodes { author { login } createdAt body isMinimized }
                        }
                    }
                }
            }
        }
    }
}`;

const fail = (...lines) => {
    lines.forEach((line) => console.error(line));
    process.exit(1);
};

const out = process.argv[2];
if (!out) fail('Usage: node comments-server/giscus-import.mjs <output file>');

const graphql = (cursor) => {
    const args = ['api', 'graphql', '-f', `query=${QUERY}`, '-f', `owner=${REPO.owner}`, '-f', `name=${REPO.name}`];
    if (cursor) args.push('-f', `cursor=${cursor}`);
    try {
        return JSON.parse(execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }));
    } catch {
        fail('Could not read the discussions through the GitHub CLI (gh\'s error is above).',
            'If gh isn\'t installed or signed in: https://cli.github.com, then gh auth login');
    }
};

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Blank lines separate paragraphs; single newlines stay line breaks
const toHtml = (markdown) => markdown.replace(/\r\n/g, '\n').split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

const toComment = (node, pageId, parentId = null) => ({
    id: randomUUID(),
    parentId,
    pageId,
    markdown: node.body,
    html: toHtml(node.body),
    score: 0,
    isSticky: false,
    isApproved: true,
    isPending: false,
    isDeleted: false,
    createdTime: node.createdAt,
    moderatedTime: node.createdAt,
    userCreated: ANONYMOUS,
    // A deleted GitHub account has no author; GitHub shows those as "ghost"
    authorName: node.author?.login ?? 'ghost'
});

const pages = [];
const comments = [];
let cursor = null;
do {
    const { discussions } = graphql(cursor).data.repository;
    for (const discussion of discussions.nodes) {
        if (discussion.category.name !== CATEGORY || !TERM.test(discussion.title)) continue;
        const page = { id: randomUUID(), path: `/${discussion.title}`, isReadonly: false };
        let count = 0;
        for (const node of discussion.comments.nodes.filter((c) => !c.isMinimized)) {
            const parent = toComment(node, page.id);
            const replies = node.replies.nodes.filter((r) => !r.isMinimized).map((r) => toComment(r, page.id, parent.id));
            comments.push(parent, ...replies);
            count += 1 + replies.length;
            if (node.replies.pageInfo.hasNextPage) console.error(`  ${page.path}: a comment has more than 100 replies; only the first 100 are included`);
        }
        if (discussion.comments.pageInfo.hasNextPage) console.error(`  ${page.path}: more than 100 comments; only the first 100 are included`);
        if (count === 0) continue;
        pages.push(page);
        console.log(`${page.path}: ${count} comment${count === 1 ? '' : 's'}`);
    }
    cursor = discussions.pageInfo.hasNextPage ? discussions.pageInfo.endCursor : null;
} while (cursor);

if (comments.length === 0) fail('No giscus comments found; there is nothing to import.');
writeFileSync(out, `${JSON.stringify({ version: 3, pages, comments, commenters: [] }, null, 2)}\n`);
console.log(`Wrote ${comments.length} comments on ${pages.length} page${pages.length === 1 ? '' : 's'} to ${out}.`,
    'Upload it in Comentario: the domain → Operations → Import data → Commento/Comentario.');
