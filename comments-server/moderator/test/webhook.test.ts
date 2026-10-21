import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePayload, verifySignature } from '../src/webhook.ts';
import { SECRET, payload, sign } from './helpers.ts';

const body = JSON.stringify(payload());

test('accepts a correctly signed, fresh delivery', () => {
    const headers = sign(body);
    assert.equal(verifySignature(SECRET, headers['X-Comentario-Timestamp'], headers['X-Comentario-Signature'], Buffer.from(body)), true);
});

test('matches the Node example in the Comentario docs (secret decoded from hex)', () => {
    // Signing with the hex string's characters instead of its bytes must fail
    const headers = sign(body, undefined, Buffer.from('8f3c2a1b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8'));
    assert.equal(verifySignature(SECRET, headers['X-Comentario-Timestamp'], headers['X-Comentario-Signature'], Buffer.from(body)), false);
});

test('rejects a tampered body, a wrong key, and missing headers', () => {
    const headers = sign(body);
    assert.equal(verifySignature(SECRET, headers['X-Comentario-Timestamp'], headers['X-Comentario-Signature'], Buffer.from(`${body} `)), false);
    assert.equal(verifySignature(Buffer.alloc(32), headers['X-Comentario-Timestamp'], headers['X-Comentario-Signature'], Buffer.from(body)), false);
    assert.equal(verifySignature(SECRET, undefined, headers['X-Comentario-Signature'], Buffer.from(body)), false);
    assert.equal(verifySignature(SECRET, headers['X-Comentario-Timestamp'], undefined, Buffer.from(body)), false);
    assert.equal(verifySignature(SECRET, headers['X-Comentario-Timestamp'], 'sha256=00', Buffer.from(body)), false);
});

test('rejects deliveries signed more than five minutes away from now', () => {
    const now = Date.now();
    const stale = sign(body, Math.floor(now / 1000) - 301);
    const future = sign(body, Math.floor(now / 1000) + 301);
    assert.equal(verifySignature(SECRET, stale['X-Comentario-Timestamp'], stale['X-Comentario-Signature'], Buffer.from(body), now), false);
    assert.equal(verifySignature(SECRET, future['X-Comentario-Timestamp'], future['X-Comentario-Signature'], Buffer.from(body), now), false);
});

test('parses the documented payload and tolerates a ping without data', () => {
    const parsed = parsePayload(Buffer.from(body));
    assert.equal(parsed?.data.comment?.authorName, 'Alice');
    assert.equal(parsed?.data.comment?.isPending, true);
    assert.equal(parsed?.data.page?.path, '/blog/pretraingym/');
    const ping = parsePayload(Buffer.from(JSON.stringify({ ...payload(), eventType: 'ping', data: {} })));
    assert.equal(ping?.eventType, 'ping');
    assert.equal(parsePayload(Buffer.from('not json')), undefined);
    assert.equal(parsePayload(Buffer.from('{"eventType":"comment.created"}')), undefined);
});
