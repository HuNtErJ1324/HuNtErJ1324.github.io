// Turns Claude's verdict into what happens to the comment. It may approve or
// reject on its own, with one exception: a comment carrying a link or an
// image always waits for a person. Links are what spam is for, so a comment
// that talks its way past the classifier still gains nothing.
import type { Verdict } from './classify.ts';
import type { WebhookComment } from './webhook.ts';

export type Action = 'approve' | 'reject' | 'hold';

const LINK_IN_HTML = /<(?:a|img)\b/i;
const LINK_IN_TEXT = /\bhttps?:\/\/|\bwww\.[a-z0-9-]+\./i;

export const hasLinkOrImage = (comment: Pick<WebhookComment, 'markdown' | 'html'>): boolean =>
    LINK_IN_HTML.test(comment.html) || LINK_IN_TEXT.test(comment.markdown);

export const decide = (verdict: Verdict, comment: Pick<WebhookComment, 'markdown' | 'html'>): { action: Action; note?: string } => {
    if (verdict.decision === 'approve' && hasLinkOrImage(comment)) {
        return { action: 'hold', note: 'Contains a link or image, so it needs your approval.' };
    }
    return { action: verdict.decision };
};
