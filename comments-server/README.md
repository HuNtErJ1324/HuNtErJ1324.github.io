# Comments server

Comments on justin-chae.org run on the home server, not on GitHub, so readers can comment without any account.

```
reader's browser ── justin-chae.org (GitHub Pages: the post, with an empty <comentario-comments>)
        │
        └─ comments.justin-chae.org ── Cloudflare ══ tunnel ══▶ cloudflared ─▶ comentario :80  (SQLite in ./data)
                                                                                   │ webhook: new/edited comment
                                                                                   ▼
                                                              moderator :8080 ─▶ Claude Haiku (api.anthropic.com)
                                                                   │ approve / reject over Comentario's API
                                                                   └─▶ ntfy (your phone): held, rejected, errors
```

- **[Comentario](https://comentario.app)** stores and serves the comments. Readers comment with just a name (or none), or make an account. Comments from readers who aren't signed in wait in a moderation queue.
- **The moderator** (`moderator/`, TypeScript) gets a signed webhook for each comment that lands in that queue and asks Claude Haiku 5.5 for `approve`, `hold`, or `reject`. It approves or rejects through Comentario's API. Anything held waits for you, and so does any comment with a link or an image, whatever Claude said. If something fails, the comment stays pending. Each comment costs about $0.0002.
- **cloudflared** connects out to Cloudflare, so no port is open on your router and your home IP stays hidden. Comentario's port is published only on the Tailscale address, for first-time setup.

The blog side lives in this repo too: `src/lib/comments.ts` (the server's URL), `src/layouts/Post.astro` (the embed), `src/layouts/Base.astro` (CSP), `public/script.js` §9 (lazy-loads the widget) and `public/home.css` (Rosé Pine colors for the widget).

## What you need

- The home server, with Docker Compose v2 and Tailscale.
- justin-chae.org's DNS on Cloudflare (it is).
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com) → API keys). Set a monthly spend limit on it.
- Optional: the [ntfy](https://ntfy.sh) app on your phone, for notifications.

## Setup

### 1. Get the files onto the server

```sh
git clone --depth 1 --filter=blob:none --sparse https://github.com/HuNtErJ1324/HuNtErJ1324.github.io.git site
cd site && git sparse-checkout set comments-server && cd comments-server
cp .env.example .env && chmod 600 .env
openssl rand -hex 32    # paste into .env as COMENTARIO_SIGNING_KEY
```

Set `TAILSCALE_IP` in `.env` to the server's Tailscale address (`tailscale ip -4`).

### 2. Create your admin account, over Tailscale only

```sh
BASE_URL=http://<tailscale-ip>:8080 docker compose up -d comentario
```

From a device on your tailnet, open `http://<tailscale-ip>:8080/en/auth/signup` and sign up. **The first account on a Comentario server becomes its superuser.** That's why this happens before the tunnel exists: nobody else can reach the server yet.

### 3. Put it online

In the Cloudflare dashboard, open **Zero Trust → Networks → Tunnels → Create a tunnel**, choose **Cloudflared**, and name it `comments`. Cloudflare shows an install command: copy the long token after `--token` into `.env` as `TUNNEL_TOKEN`. Skip the install step, since the compose file runs cloudflared. Then add a public hostname (Cloudflare also calls these *published application routes*):

- Subdomain `comments`, domain `justin-chae.org`
- Service type **HTTP**, URL `comentario:80`

Then, without the `BASE_URL` override:

```sh
docker compose up -d comentario cloudflared
```

This restarts Comentario under its public address (`https://comments.justin-chae.org`, the `BASE_URL` default). Check that <https://comments.justin-chae.org/comentario.js> loads, then sign in at <https://comments.justin-chae.org/en/auth/login>. From now on, use that address for the Administration UI. The Tailscale address stops working for it, because the UI calls the server at its public address. Any `docker compose` command that omits `BASE_URL` brings back the public address, which is why the tunnel goes up first.

### 4. Add the blog

In the Administration UI, **Domains → New domain**:

- **General:** Host `https://` `justin-chae.org`. Further down, turn off **Enable images in comments**: the blog's CSP wouldn't display outside images anyway.
- **Authentication:** turn on **Commenting without registration**. Leave **Local (password-based)** on if readers should also be able to make accounts.
- **Moderation:** under *Require moderator approval on comment, if*, tick **Author is unregistered**, **Comment contains link**, and **Comment contains image**. Set **Email moderators** to never: no email is set up, and the moderator notifies you instead.

### 5. Connect the moderator

1. **Webhook.** Open the domain → **Webhooks → New webhook**. Set the target URL to `http://moderator:8080/webhook` and pick the events for new and edited comments (`comment.created`, `comment.updated`). Save, then copy the **signing secret** into `.env` as `WEBHOOK_SECRET`. Comentario shows it only once.
2. **Moderator account.** In a private window, sign up a second account at <https://comments.justin-chae.org/en/auth/signup> (for example `moderator@justin-chae.org`, with a password from `openssl rand -base64 24`). Put both in `.env` as `MODERATOR_EMAIL` and `MODERATOR_PASSWORD`. A separate account means the password in `.env` can moderate comments and do nothing else.
3. **Claude.** Put the API key in `.env` as `ANTHROPIC_API_KEY`. Leave `DRY_RUN=true` for now.
4. **Phone notifications (optional).** In the ntfy app, subscribe to a topic with a long random name (anyone who guesses a public ntfy.sh topic can read it). Set `NOTIFY_URL=https://ntfy.sh/<that topic>`.
5. **Check it all:**

   ```sh
   docker compose run --rm moderator node src/check.ts
   ```

   The first run reports that the moderator account isn't a moderator yet. Signing in has now added it to the domain, so open **Domains → justin-chae.org → Users → (the moderator account)**, set the role to **Moderator**, and run the check again until every line says `ok`. It signs in, asks Claude about a sample comment, and sends a test notification. It doesn't touch any real comment.
6. **Start it:** `docker compose up -d`. Then on the webhook's page, click **Send test event**: the moderator answers `200 pong`.

### 6. Deploy the site

Once the site with the Comentario embed is deployed, every post has a comment thread. Comments have to come from justin-chae.org itself: Comentario refuses other origins, including `localhost` previews. To try comments locally, add a `localhost:4321` domain in Comentario and build with `COMMENTS_URL` pointing at the server.

### 7. Harden

- **Close Administration UI sign-ups.** In the instance configuration (as superuser), turn off **Enable registration of new users**. This only covers the Administration UI: readers can still make accounts in the comment widget.
- **Rate-limit new comments** in Cloudflare: **Security → WAF → Rate limiting rules**. Match hostname `comments.justin-chae.org`, method `PUT`, and URI path `/api/embed/comments`. Allow, say, 5 requests per 10 seconds per IP, and block for 10 seconds. The free plan includes one rule.

## Day to day

- **Moderating.** Your phone gets a notification for every comment that's held, rejected, or failed. Tap it to open the comment on the blog. Signed in to the widget with your admin account, you can approve or reject it right there. The Administration UI lists the queue too.
- **Logs.** Run `docker compose logs -f moderator` for one JSON line per comment: Claude's decision, category, reason, and what was done.
- **Leaving the dry run.** After a week or two of agreeing with Claude's verdicts, set `DRY_RUN=false` and run `docker compose up -d moderator`.
- **Backups.** Everything is in `./data/comentario.sqlite3`. It contains commenters' names, emails, and IP addresses, so keep copies private. SQLite can back itself up while running, for example from a nightly cron job on the server:

  ```sh
  sqlite3 data/comentario.sqlite3 ".backup '/path/off/this/disk/comentario-$(date +%F).sqlite3'"
  ```

- **Upgrades.** Change the image tag in `docker-compose.yml` after reading [Comentario's changelog](https://gitlab.com/comentario/comentario/-/blob/master/CHANGELOG.md), then run `docker compose pull && docker compose up -d`. Afterwards, look at a post's comments: the colors in `public/home.css` override comentario.css selectors that could change. To update the moderator, pull the repo and run `docker compose up -d --build moderator`.
- **When the server is down,** posts say "Comments are unavailable right now" and the rest of the site is unaffected. Comentario retries a webhook delivery for about an hour. Anything the moderator missed stays pending for you.

## Optional: sign in with GitHub or Google

Comentario reads identity-provider keys from a secrets file rather than environment variables. Create the OAuth app with the callback `https://comments.justin-chae.org/api/oauth/github/callback` (see [Comentario's guide](https://docs.comentario.app/en/configuration/idps/github/)). Add the keys to a `secrets.yaml` next to `.env` (git-ignored), then add `SECRETS_FILE: /secrets.yaml` and the volume `./secrets.yaml:/secrets.yaml:ro` to the `comentario` service. Enable the provider in the domain's **Authentication** tab.

## Developing the moderator

```sh
cd moderator
npm install
npm test            # node:test, with fake Comentario, Anthropic, and ntfy servers
npm run typecheck
```

Node runs the TypeScript directly (type stripping), so there's no build step. Keep to erasable syntax: no enums, no parameter properties.
