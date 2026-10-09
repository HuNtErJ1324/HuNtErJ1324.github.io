// Commit, pull, and push drafts/ — a clone of the PRIVATE blog-drafts repo.
//
//   npm run drafts:sync [-- "commit message"] [--allow-markers]
//
// --allow-markers: push even though a draft contains lines that look like
// git conflict markers (e.g. a post that shows a merge conflict in a code block).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const git = (...args) => execFileSync('git', ['-C', 'drafts', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const fail = (...lines) => {
    lines.forEach((line) => console.error(line));
    process.exit(1);
};

const conflictHelp = [
    'Resolve it in drafts/ first, then re-run:',
    '  git -C drafts status    # lists the conflicted files',
    '  # edit each one: keep the text you want and delete the <<<<<<< ======= >>>>>>> lines',
    '  git -C drafts add -A && git -C drafts rebase --continue && npm run drafts:sync'
];

const offlineHelp = 'Could not reach the drafts remote; your changes are committed locally. Re-run npm run drafts:sync when online.';

// A rebase or merge stopped on a conflict (from a previous sync). --git-path
// answers relative to drafts/, where `git -C drafts` runs.
const conflictInProgress = () => ['rebase-merge', 'rebase-apply', 'MERGE_HEAD']
    .some((name) => existsSync(resolve('drafts', git('rev-parse', '--git-path', name).trim())))
    || git('diff', '--name-only', '--diff-filter=U').trim() !== '';

if (!existsSync('drafts/.git')) {
    fail('drafts/ is not a clone of the drafts repo. Set it up with:',
        '  git clone git@github.com:HuNtErJ1324/blog-drafts.git drafts');
}

// Never `add -A` over conflict markers
if (conflictInProgress()) {
    fail('drafts/ has an unfinished conflict; nothing was committed or pushed.', ...conflictHelp);
}

const args = process.argv.slice(2);
const allowMarkers = args.includes('--allow-markers');
const message = args.filter((arg) => arg !== '--allow-markers').join(' ') || 'Update drafts';

// Files at HEAD with lines that look like unresolved conflict markers
const filesWithMarkers = () => {
    try {
        return git('grep', '-l', '-E', '^(<{7}|>{7})( |$)', 'HEAD', '--').trim();
    } catch {
        return ''; // git grep exits 1 when nothing matches
    }
};

// Commit first, so a conflicting pull stops the rebase instead of
// committing conflict markers (as `pull --autostash` + `add -A` would)
git('add', '-A');
if (git('status', '--porcelain').trim()) {
    git('commit', '-m', message);
    console.log(`Committed: ${message}`);
} else {
    console.log('No draft changes to commit.');
}

let remoteHasBranches;
try {
    remoteHasBranches = git('ls-remote', '--heads', 'origin').trim() !== '';
} catch {
    fail(offlineHelp);
}

// An empty remote has nothing to pull yet
if (remoteHasBranches) {
    try {
        git('pull', '--rebase');
    } catch {
        if (conflictInProgress()) {
            fail('Pulling hit a conflict; nothing was pushed.', ...conflictHelp);
        }
        fail(offlineHelp);
    }
}

try {
    git('rev-parse', '--verify', '--quiet', 'HEAD');
} catch {
    console.log('No commits yet; nothing to push.');
    process.exit(0);
}

// Never push conflict markers (e.g. `add -A` before a conflicted file was fixed)
const marked = allowMarkers ? '' : filesWithMarkers();
if (marked) {
    fail('Not pushing: these drafts still contain conflict markers (<<<<<<< / >>>>>>>):',
        ...marked.split('\n').map((file) => `  ${file.replace(/^HEAD:/, 'drafts/')}`),
        'Fix them, commit, and re-run npm run drafts:sync',
        '(or pass --allow-markers if a post really shows conflict markers).');
}

try {
    git('push', '-u', 'origin', 'HEAD');
} catch {
    fail(offlineHelp);
}
console.log('Drafts synced with HuNtErJ1324/blog-drafts (private).');
