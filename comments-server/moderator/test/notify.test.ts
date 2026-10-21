import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notifier } from '../src/notify.ts';
import { fakeServer } from './helpers.ts';

test('publishes JSON to the ntfy server root, with the token when set', async () => {
    const ntfy = await fakeServer((_req, _body, res) => { res.writeHead(200); res.end('{}'); });
    const notify = notifier(`${ntfy.url}/blog-comments-x1y2`, 'tk_secret');
    await notify({ title: 'Comment needs review — “quotes”', message: 'Alice on /blog/x/: hi', priority: 3, click: 'https://justin-chae.org/blog/x/#c' });
    const [request] = ntfy.requests;
    assert.equal(request.url, '/');
    assert.equal(request.headers.authorization, 'Bearer tk_secret');
    assert.deepEqual(JSON.parse(request.body), {
        topic: 'blog-comments-x1y2',
        title: 'Comment needs review — “quotes”',
        message: 'Alice on /blog/x/: hi',
        priority: 3,
        click: 'https://justin-chae.org/blog/x/#c',
    });
    await ntfy.close();
});

test('does nothing without a topic URL and refuses a URL without a topic', async () => {
    await notifier(undefined, undefined)({ title: 't', message: 'm', priority: 3 });
    assert.throws(() => notifier('https://ntfy.sh/', undefined), /topic URL/);
});
