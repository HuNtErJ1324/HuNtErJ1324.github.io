// Comentario's outbound webhooks (https://docs.comentario.app/en/kb/webhooks/):
// signature check and the parts of the payload the moderator reads.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

// Deliveries older (or newer) than this are refused, so a captured one can't be replayed.
const MAX_SKEW_SECONDS = 5 * 60;

// The signature is "sha256=" + hex HMAC-SHA256 over "<timestamp>.<raw body>",
// keyed with the secret's decoded bytes.
export const verifySignature = (
    key: Buffer,
    timestamp: string | undefined,
    signature: string | undefined,
    body: Buffer,
    now = Date.now(),
): boolean => {
    if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
    if (Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
    const expected = Buffer.from(`sha256=${createHmac('sha256', key).update(`${timestamp}.`).update(body).digest('hex')}`);
    const received = Buffer.from(signature);
    // timingSafeEqual() throws on a length mismatch, so compare lengths first
    return received.length === expected.length && timingSafeEqual(expected, received);
};

const Comment = z.object({
    id: z.string(),
    parentId: z.string().optional(),
    markdown: z.string().default(''),
    html: z.string().default(''),
    isPending: z.boolean().default(false),
    isDeleted: z.boolean().default(false),
    pendingReason: z.string().optional(),
    authorName: z.string().optional(),
    url: z.string().optional(),
});

export const Payload = z.object({
    eventId: z.string(),
    eventType: z.string(),
    domain: z.object({ id: z.string(), host: z.string() }),
    data: z.object({
        comment: Comment.optional(),
        page: z.object({ path: z.string().default('/'), title: z.string().default('') }).optional(),
        commenter: z.object({ name: z.string().optional() }).optional(),
    }),
});

export type Payload = z.infer<typeof Payload>;
export type WebhookComment = z.infer<typeof Comment>;

export const parsePayload = (body: Buffer): Payload | undefined => {
    try {
        const result = Payload.safeParse(JSON.parse(body.toString('utf8')));
        return result.success ? result.data : undefined;
    } catch {
        return undefined;
    }
};
