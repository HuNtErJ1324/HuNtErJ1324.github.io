// Setup check, run on the server:
//   docker compose run --rm moderator node src/check.ts
// Signs in to Comentario as the moderator account (which also adds it to the
// blog's domain, so it can be given the Moderator role), asks Claude about a
// sample comment, and sends a test notification if ntfy is set up. It never
// touches a real comment. Exits 1 if anything needs fixing.
import Anthropic from '@anthropic-ai/sdk';
import { classify } from './classify.ts';
import { comentarioClient } from './comentario.ts';
import { loadConfig } from './config.ts';
import { notifier } from './notify.ts';

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
let failed = false;
const ok = (line: string) => console.log(`ok    ${line}`);
const fail = (line: string) => {
    failed = true;
    console.log(`FAIL  ${line}`);
};

const config = loadConfig();
const comentario = comentarioClient({ baseUrl: config.comentarioUrl, email: config.moderatorEmail, password: config.moderatorPassword });

try {
    const domainId = await comentario.domainIdFor(config.siteHost);
    const { principal } = await comentario.signIn(domainId);
    ok(`Comentario: signed in as ${config.moderatorEmail} on ${config.siteHost}`);
    if (principal.isModerator || principal.isOwner || principal.isSuperuser) {
        ok(`Comentario: ${config.moderatorEmail} can moderate ${config.siteHost}`);
        if (principal.isOwner || principal.isSuperuser) {
            console.log('      (it is an owner or superuser: a separate account with just the Moderator role is safer)');
        }
    } else {
        fail(`Comentario: ${config.moderatorEmail} isn't a moderator of ${config.siteHost} yet. In the Administration UI, open `
            + `Domains → ${config.siteHost} → Users → ${config.moderatorEmail}, set the role to Moderator, and run this again.`);
    }
} catch (err) {
    fail(`Comentario: ${errorText(err)}. Check MODERATOR_EMAIL and MODERATOR_PASSWORD, and that the domain ${config.siteHost} exists.`);
}

try {
    const verdict = await classify(new Anthropic({ timeout: 30_000, maxRetries: 1 }), config.model, {
        pageTitle: 'Setup check',
        pagePath: '/blog/',
        author: 'Setup check',
        isReply: false,
        markdown: 'Thanks for writing this up, the evaluation section was really clear.',
    });
    ok(`Claude (${config.model}): ${verdict.decision} (${verdict.category}): ${verdict.reason}`);
} catch (err) {
    fail(`Claude (${config.model}): ${errorText(err)}`);
}

if (config.notifyUrl) {
    try {
        await notifier(config.notifyUrl, config.notifyToken)({
            title: 'Comment moderator: setup check',
            message: 'Notifications work. Held and rejected comments will show up here.',
            priority: 3,
        });
        ok('ntfy: test notification sent');
    } catch (err) {
        fail(`ntfy: ${errorText(err)}`);
    }
} else {
    console.log('–     ntfy: not set up (NOTIFY_URL is empty), so there will be no phone notifications');
}

console.log(config.dryRun ? '\nDRY_RUN is on: verdicts are logged and notified, but no comment is approved or rejected.' : '');
process.exit(failed ? 1 : 0);
