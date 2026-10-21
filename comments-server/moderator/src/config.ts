// Settings, from the environment (docker-compose.yml passes them in from
// ../.env). A missing value stops the service at startup rather than on the
// first comment.

export interface Config {
    port: number;
    // The blog's host as registered in Comentario; events for any other
    // domain on the server are ignored.
    siteHost: string;
    // HMAC key: the hex-decoded bytes of the webhook's signing secret.
    webhookSecret: Buffer;
    // Comentario's API, reached over the compose network.
    comentarioUrl: string;
    moderatorEmail: string;
    moderatorPassword: string;
    model: string;
    // Classify and notify, but leave every comment pending.
    dryRun: boolean;
    // ntfy topic URL (https://ntfy.sh/<topic> or a self-hosted server).
    notifyUrl: string | undefined;
    notifyToken: string | undefined;
}

const required = (env: NodeJS.ProcessEnv, name: string): string => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`${name} is not set`);
    return value;
};

const optional = (env: NodeJS.ProcessEnv, name: string): string | undefined => env[name]?.trim() || undefined;

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
    // Read by the Anthropic SDK itself; checked here so a missing key fails fast.
    required(env, 'ANTHROPIC_API_KEY');
    const secret = required(env, 'WEBHOOK_SECRET');
    if (!/^(?:[0-9a-f]{2})+$/i.test(secret)) {
        throw new Error('WEBHOOK_SECRET must be the hex string Comentario showed when the webhook was created');
    }
    const port = Number(env.PORT ?? 8080);
    if (!Number.isInteger(port) || port <= 0) throw new Error(`PORT is not a port number: ${env.PORT}`);
    return {
        port,
        siteHost: required(env, 'SITE_HOST'),
        webhookSecret: Buffer.from(secret, 'hex'),
        comentarioUrl: (optional(env, 'COMENTARIO_URL') ?? 'http://comentario').replace(/\/+$/, ''),
        moderatorEmail: required(env, 'MODERATOR_EMAIL'),
        moderatorPassword: required(env, 'MODERATOR_PASSWORD'),
        model: optional(env, 'MODEL') ?? 'claude-haiku-5-5',
        dryRun: env.DRY_RUN?.trim() === 'true',
        notifyUrl: optional(env, 'NOTIFY_URL'),
        notifyToken: optional(env, 'NOTIFY_TOKEN'),
    };
};
