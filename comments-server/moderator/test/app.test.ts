import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createApp } from '../src/app.ts';
import type { CommentInput, Verdict } from '../src/classify.ts';
import type { Notification } from '../src/notify.ts';
import { SECRET, close, listen, payload, sign } from './helpers.ts';

let verdict: Verdict | Error;
let moderateError: Error | undefined;
const classified: CommentInput[] = [];
const moderated: { domainId: string; commentId: string; approve: boolean }[] = [];
const notified: Notification[] = [];
const logged: Record<string, unknown>[] = [];

const app = (dryRun = false) => createApp({
    webhookSecret: SECRET,
    siteHost: 'justin-chae.org',
    dryRun,
    classify: async (input) => {
        classified.push(input);
        if (verdict instanceof Error) throw verdict;
        return verdict;
    },
    moderate: async (domainId, commentId, approve) => {
        if (moderateError) throw moderateError;
        moderated.push({ domainId, commentId, approve });
    },
    notify: async (notification) => { notified.push(notification); },
    log: (entry) => { logged.push(entry); },
});

const live = app();
const url = await listen(live.server);
after(() => close(live.server));

beforeEach(() => {
    verdict = { decision: 'approve', category: 'ok', reason: 'A reader thanking the author.' };
    moderateError = undefined;
    for (const list of [classified, moderated, notified, logged]) list.length = 0;
});

let eventCounter = 0;
const deliver = async (body: object, { target = url, signed = true } = {}) => {
    const text = JSON.stringify(body);
    const res = await fetch(`${target}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...signed ? sign(text) : {} },
        body: text,
    });
    return { status: res.status, text: (await res.text()).trim() };
};
const event = (comment: Record<string, unknown> = {}, extra: Parameters<typeof payload>[0] = {}) =>
    payload({ eventId: `evt-${++eventCounter}`, comment, ...extra });

test('approves a pending comment Claude approves, without a notification', async () => {
    assert.deepEqual(await deliver(event()), { status: 202, text: 'accepted' });
    await live.idle();
    assert.equal(classified[0].author, 'Alice');
    assert.equal(classified[0].pagePath, '/blog/pretraingym/');
    assert.equal(classified[0].isReply, false);
    assert.deepEqual(moderated, [{ domainId: '3c5f1a88-0c8e-4a2f-9b6d-11e2c7a45f90', commentId: '9d4b2c11-8e77-4f30-a1c5-6b0d3e9f2a48', approve: true }]);
    assert.equal(notified.length, 0);
    assert.equal(logged[0].action, 'approve');
});

test('rejects spam and sends a low-priority notification', async () => {
    verdict = { decision: 'reject', category: 'spam', reason: 'Crypto promotion.' };
    await deliver(event({ markdown: 'Buy coins at https://scam.example', html: '<p>Buy coins at <a href="https://scam.example">https://scam.example</a></p>' }));
    await live.idle();
    assert.deepEqual(moderated.map((m) => m.approve), [false]);
    assert.equal(notified[0].title, 'Comment rejected');
    assert.equal(notified[0].priority, 2);
    assert.match(notified[0].message, /Alice on \/blog\/pretraingym\/: Buy coins/);
});

test('holds an approved comment with a link, and leaves it pending', async () => {
    await deliver(event({ markdown: 'Related: https://arxiv.org/abs/1234', html: '<p>Related: <a href="https://arxiv.org/abs/1234">link</a></p>' }));
    await live.idle();
    assert.equal(moderated.length, 0);
    assert.equal(notified[0].title, 'Comment needs review');
    assert.equal(notified[0].priority, 3);
    assert.match(notified[0].message, /needs your approval/);
    assert.equal(notified[0].click, 'https://justin-chae.org/blog/pretraingym/#comentario-9d4b2c11-8e77-4f30-a1c5-6b0d3e9f2a48');
});

test('holds when the classifier fails, and flags a failed moderation call', async () => {
    verdict = new Error('overloaded');
    await deliver(event());
    await live.idle();
    assert.equal(moderated.length, 0);
    assert.match(notified[0].message, /Classifier error: overloaded/);

    verdict = { decision: 'approve', category: 'ok', reason: 'Fine.' };
    moderateError = new Error('HTTP 502');
    await deliver(event());
    await live.idle();
    assert.equal(notified[1].title, 'Comment moderation failed');
    assert.equal(notified[1].priority, 4);
    assert.match(notified[1].message, /still pending/);
});

test('skips comments that are already published, deleted, or on another domain', async () => {
    await deliver(event({ isPending: false, isApproved: true }));
    await deliver(event({ isDeleted: true }));
    await deliver(event({}, { host: 'other.example' }));
    await live.idle();
    assert.equal(classified.length, 0);
    assert.deepEqual(logged.map((l) => l.skipped), ['not pending', 'not pending', 'domain other.example']);
});

test('moderates edits that sent a comment back to the queue, and ignores other events', async () => {
    await deliver(event({}, { eventType: 'comment.updated' }));
    assert.deepEqual(await deliver(event({}, { eventType: 'comment.approved' })), { status: 200, text: 'ignored' });
    assert.deepEqual(await deliver({ ...event(), eventType: 'ping', data: {} }), { status: 200, text: 'pong' });
    await live.idle();
    assert.equal(classified.length, 1);
});

test('drops repeated deliveries of the same event', async () => {
    const body = event();
    assert.equal((await deliver(body)).status, 202);
    assert.deepEqual(await deliver(body), { status: 200, text: 'duplicate' });
    await live.idle();
    assert.equal(classified.length, 1);
});

test('refuses unsigned, tampered, and malformed requests', async () => {
    assert.equal((await deliver(event(), { signed: false })).status, 401);
    const text = JSON.stringify(event());
    const tampered = await fetch(`${url}/webhook`, { method: 'POST', headers: sign(text), body: text.replace('Alice', 'Mallory') });
    assert.equal(tampered.status, 401);
    const junk = '{"hello":"world"}';
    assert.equal((await fetch(`${url}/webhook`, { method: 'POST', headers: sign(junk), body: junk })).status, 400);
    assert.equal((await fetch(`${url}/healthz`)).status, 200);
    assert.equal((await fetch(`${url}/`)).status, 404);
    assert.equal(classified.length, 0);
});

test('in a dry run, classifies and notifies but moderates nothing', async () => {
    const dry = app(true);
    const dryUrl = await listen(dry.server);
    await deliver(event(), { target: dryUrl });
    await dry.idle();
    await close(dry.server);
    assert.equal(moderated.length, 0);
    assert.equal(notified[0].title, 'Dry run: would approve');
    assert.equal(logged[0].action, 'none (dry run)');
});
