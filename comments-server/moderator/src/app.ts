// The webhook endpoint. Comentario gives each delivery 10 seconds, so a
// verified event is acknowledged right away and moderated afterwards, one at
// a time. Whatever goes wrong leaves the comment pending, which is where an
// unmoderated comment belongs.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { CommentInput, Verdict } from './classify.ts';
import type { Notification } from './notify.ts';
import { decide, type Action } from './policy.ts';
import { parsePayload, verifySignature, type Payload, type WebhookComment } from './webhook.ts';

export interface AppDeps {
    webhookSecret: Buffer;
    siteHost: string;
    dryRun: boolean;
    classify: (input: CommentInput) => Promise<Verdict>;
    moderate: (domainId: string, commentId: string, approve: boolean) => Promise<void>;
    notify: (notification: Notification) => Promise<void>;
    log: (entry: Record<string, unknown>) => void;
}

const MAX_BODY_BYTES = 256 * 1024;
// Beyond this, deliveries get a 503 and Comentario retries them later.
const MAX_QUEUED = 200;
// Deliveries are at-least-once: remember recent event IDs to drop repeats.
const REMEMBERED_EVENTS = 1000;
const MODERATED_EVENTS = new Set(['comment.created', 'comment.updated']);

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

const excerpt = (text: string, max = 280) => {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

// Undefined when the body is over the limit (the rest is drained, not stored).
const readBody = (req: IncomingMessage): Promise<Buffer | undefined> => new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size <= MAX_BODY_BYTES) chunks.push(chunk);
    });
    req.on('end', () => resolve(size <= MAX_BODY_BYTES ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
});

const reply = (res: ServerResponse, status: number, text: string) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`${text}\n`);
};

const header = (req: IncomingMessage, name: string) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
};

interface Outcome {
    comment: WebhookComment;
    author: string;
    path: string;
    verdict: Verdict;
    action: Action;
    note?: string;
    error?: string;
    dryRun: boolean;
}

const TITLES: Record<Action, string> = { approve: 'Comment approved', reject: 'Comment rejected', hold: 'Comment needs review' };
const DRY_RUN_TITLES: Record<Action, string> = { approve: 'Dry run: would approve', reject: 'Dry run: would reject', hold: 'Dry run: would hold' };

// What reaches your phone: everything that isn't a plain approval.
const notificationFor = ({ comment, author, path, verdict, action, note, error, dryRun }: Outcome): Notification | undefined => {
    if (action === 'approve' && !dryRun && !error) return undefined;
    const lines = [
        `${author} on ${path}: ${excerpt(comment.markdown)}`,
        '',
        `Claude: ${verdict.decision} (${verdict.category}). ${verdict.reason}`,
        ...note ? [note] : [],
        ...error ? [`Error: ${error}`, 'The comment is still pending.'] : [],
    ];
    return {
        title: error ? 'Comment moderation failed' : (dryRun ? DRY_RUN_TITLES : TITLES)[action],
        message: lines.join('\n'),
        priority: error ? 4 : action === 'hold' ? 3 : 2,
        click: comment.url,
    };
};

export const createApp = (deps: AppDeps) => {
    const seen = new Set<string>();
    let queue: Promise<void> = Promise.resolve();
    let queued = 0;

    const moderateEvent = async ({ eventId, domain, data }: Payload) => {
        const { comment, page, commenter } = data;
        if (!comment) return;
        const path = page?.path ?? '/';
        const base = { eventId, commentId: comment.id, page: path };
        if (domain.host !== deps.siteHost) return deps.log({ ...base, skipped: `domain ${domain.host}` });
        if (!comment.isPending || comment.isDeleted) return deps.log({ ...base, skipped: 'not pending' });

        const started = Date.now();
        const author = comment.authorName || commenter?.name || 'Anonymous';
        let verdict: Verdict;
        try {
            verdict = await deps.classify({
                pageTitle: page?.title ?? '',
                pagePath: path,
                author,
                isReply: Boolean(comment.parentId),
                markdown: comment.markdown,
            });
        } catch (err) {
            verdict = { decision: 'hold', category: 'unclear', reason: `Classifier error: ${errorText(err)}` };
        }

        const { action, note } = decide(verdict, comment);
        let error: string | undefined;
        if (action !== 'hold' && !deps.dryRun) {
            try {
                await deps.moderate(domain.id, comment.id, action === 'approve');
            } catch (err) {
                error = errorText(err);
            }
        }
        deps.log({
            ...base,
            decision: verdict.decision,
            category: verdict.category,
            reason: verdict.reason,
            action: deps.dryRun ? 'none (dry run)' : error ? 'none (error)' : action,
            note,
            error,
            ms: Date.now() - started,
        });

        const notification = notificationFor({ comment, author, path, verdict, action, note, error, dryRun: deps.dryRun });
        if (notification) {
            await deps.notify(notification).catch((err) => deps.log({ ...base, notifyError: errorText(err) }));
        }
    };

    const handle = async (req: IncomingMessage, res: ServerResponse) => {
        const route = new URL(req.url ?? '/', 'http://moderator').pathname;
        if (req.method === 'GET' && route === '/healthz') return reply(res, 200, 'ok');
        if (req.method !== 'POST' || route !== '/webhook') return reply(res, 404, 'not found');

        const body = await readBody(req);
        if (!body) return reply(res, 413, 'payload too large');
        const signed = verifySignature(
            deps.webhookSecret,
            header(req, 'x-comentario-timestamp'),
            header(req, 'x-comentario-signature'),
            body,
        );
        if (!signed) return reply(res, 401, 'bad signature');
        const payload = parsePayload(body);
        if (!payload) return reply(res, 400, 'unrecognized payload');

        if (payload.eventType === 'ping') return reply(res, 200, 'pong');
        if (!MODERATED_EVENTS.has(payload.eventType)) return reply(res, 200, 'ignored');
        if (seen.has(payload.eventId)) return reply(res, 200, 'duplicate');
        if (queued >= MAX_QUEUED) return reply(res, 503, 'busy');

        seen.add(payload.eventId);
        if (seen.size > REMEMBERED_EVENTS) seen.delete(seen.values().next().value!);
        queued++;
        queue = queue
            .then(() => moderateEvent(payload))
            .catch((err) => deps.log({ eventId: payload.eventId, error: errorText(err) }))
            .finally(() => { queued--; });
        reply(res, 202, 'accepted');
    };

    const server = createServer((req, res) => {
        handle(req, res).catch((err) => {
            deps.log({ error: errorText(err) });
            if (!res.headersSent) reply(res, 500, 'error');
        });
    });

    // Resolves once every accepted event has been moderated.
    const idle = async () => {
        while (queued > 0) await queue;
    };

    return { server, idle };
};
