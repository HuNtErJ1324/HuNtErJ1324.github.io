import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

export const SECRET_HEX = '8f3c2a1b4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8';
export const SECRET = Buffer.from(SECRET_HEX, 'hex');

export const sign = (body: string, timestamp = Math.floor(Date.now() / 1000), key = SECRET) => ({
    'X-Comentario-Timestamp': String(timestamp),
    'X-Comentario-Signature': `sha256=${createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')}`,
});

// A payload shaped like the example in Comentario's webhook docs.
export const payload = (overrides: { eventId?: string; eventType?: string; host?: string; comment?: Record<string, unknown> } = {}) => ({
    specVersion: '1.0',
    eventId: overrides.eventId ?? '0f8a3d7e-4b2c-4d1e-9a55-6b1c2f0a77e1',
    eventType: overrides.eventType ?? 'comment.created',
    eventTime: '2026-08-26T09:41:07Z',
    webhookId: 'b21c9a04-7f3d-4a11-8c2e-52d0f7a91b33',
    domain: { id: '3c5f1a88-0c8e-4a2f-9b6d-11e2c7a45f90', host: overrides.host ?? 'justin-chae.org', name: 'Blog' },
    data: {
        comment: {
            id: '9d4b2c11-8e77-4f30-a1c5-6b0d3e9f2a48',
            pageId: '77c1e0b5-3a9f-4c62-b8d1-2e5a904f7c31',
            markdown: 'Great post, thanks!',
            html: '<p>Great post, thanks!</p>',
            score: 0,
            isApproved: false,
            isPending: true,
            isDeleted: false,
            isSticky: false,
            pendingReason: 'Anonymous comment',
            createdTime: '2026-08-26T09:41:07Z',
            url: 'https://justin-chae.org/blog/pretraingym/#comentario-9d4b2c11-8e77-4f30-a1c5-6b0d3e9f2a48',
            authorName: 'Alice',
            ...overrides.comment,
        },
        page: { id: '77c1e0b5-3a9f-4c62-b8d1-2e5a904f7c31', path: '/blog/pretraingym/', title: 'PretrainGym', isReadonly: false },
        commenter: { id: '00000000-0000-0000-0000-000000000000', name: 'Anonymous', hasAvatar: false, isCommenter: true, isModerator: false, colourIndex: 0 },
    },
});

export const listen = (server: Server): Promise<string> => new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
});

export const close = (server: Server): Promise<void> => new Promise((resolve) => server.close(() => resolve()));

// A local HTTP server that records requests and answers through `respond`.
export const fakeServer = async (respond: (req: IncomingMessage, body: string, res: ServerResponse) => void) => {
    const requests: { method: string; url: string; headers: IncomingMessage['headers']; body: string }[] = [];
    const server = createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            requests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
            respond(req, body, res);
        });
    });
    const url = await listen(server);
    return { url, requests, close: () => close(server) };
};
