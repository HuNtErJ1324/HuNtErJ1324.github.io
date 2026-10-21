// Moderates new comments on justin-chae.org with Claude Haiku. Comentario
// POSTs a signed webhook for every new or edited comment; the ones its
// moderation policy left pending (anonymous comments) are classified, then
// approved, rejected, or left for you with a phone notification. Setup:
// ../README.md.
import Anthropic from '@anthropic-ai/sdk';
import { createApp } from './app.ts';
import { classify } from './classify.ts';
import { comentarioClient } from './comentario.ts';
import { loadConfig } from './config.ts';
import { notifier } from './notify.ts';

const config = loadConfig();
const anthropic = new Anthropic({ timeout: 30_000, maxRetries: 2 });
const comentario = comentarioClient({
    baseUrl: config.comentarioUrl,
    email: config.moderatorEmail,
    password: config.moderatorPassword,
});

// One JSON line per event, for `docker compose logs moderator`.
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ time: new Date().toISOString(), ...entry }));

const { server, idle } = createApp({
    webhookSecret: config.webhookSecret,
    siteHost: config.siteHost,
    dryRun: config.dryRun,
    classify: (input) => classify(anthropic, config.model, input),
    moderate: comentario.moderate,
    notify: notifier(config.notifyUrl, config.notifyToken),
    log,
});

server.listen(config.port, () => {
    log({ started: `listening on :${config.port}`, model: config.model, dryRun: config.dryRun, notify: Boolean(config.notifyUrl) });
});

// Finish the comments already accepted before exiting (compose waits 30s).
const shutdown = () => {
    server.close();
    idle().then(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
