import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comentarioClient } from '../src/comentario.ts';
import { fakeServer } from './helpers.ts';

const DOMAIN = '3c5f1a88-0c8e-4a2f-9b6d-11e2c7a45f90';
const COMMENT = '9d4b2c11-8e77-4f30-a1c5-6b0d3e9f2a48';

test('signs in once, reuses the session, and renews it when refused', async () => {
    let issued = 0;
    let valid = '';
    const api = await fakeServer((req, body, res) => {
        if (req.url === '/api/embed/auth/login') {
            const { email, password, domainId } = JSON.parse(body);
            assert.deepEqual({ email, password, domainId }, { email: 'mod@example.com', password: 'pw', domainId: DOMAIN });
            valid = `token-${++issued}`;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ sessionToken: valid, principal: {} }));
        }
        res.writeHead(req.headers['x-user-session'] === valid ? 204 : 401);
        res.end();
    });
    const client = comentarioClient({ baseUrl: api.url, email: 'mod@example.com', password: 'pw' });

    await client.moderate(DOMAIN, COMMENT, true);
    await client.moderate(DOMAIN, COMMENT, false);
    assert.equal(issued, 1);
    const moderations = api.requests.filter((r) => r.url === `/api/embed/comments/${COMMENT}/moderate`);
    assert.deepEqual(moderations.map((r) => JSON.parse(r.body)), [{ approve: true }, { approve: false }]);

    valid = 'expired-on-the-server';
    await client.moderate(DOMAIN, COMMENT, true);
    assert.equal(issued, 2);
    await api.close();
});

test('reports a failure it can’t fix by signing in again', async () => {
    const api = await fakeServer((req, _body, res) => {
        if (req.url === '/api/embed/auth/login') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ sessionToken: 't' }));
        }
        res.writeHead(403);
        res.end();
    });
    const client = comentarioClient({ baseUrl: api.url, email: 'mod@example.com', password: 'pw' });
    await assert.rejects(client.moderate(DOMAIN, COMMENT, true), /HTTP 403/);
    await api.close();

    const down = await fakeServer((_req, _body, res) => { res.writeHead(401); res.end(); });
    await assert.rejects(comentarioClient({ baseUrl: down.url, email: 'x@example.com', password: 'bad' }).moderate(DOMAIN, COMMENT, true), /sign-in failed: HTTP 401/);
    await down.close();
});
