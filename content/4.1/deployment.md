---
id: deployment
title: Deployment
section: Shipping
order: 62
---

Install every dependency and build for production, then drop the development ones:

```bash
npm ci && npx meocord build --prod
npm ci --omit=dev
```

With yarn, `yarn install --production`; with pnpm, `pnpm install --prod`; with bun, `bun install --production`.

The server needs:

```text
dist/
node_modules/   (production only)
package.json
.env            (if used)
<lockfile>
```

Start it in production:

```bash
npx meocord start --prod
```

To deploy `dist/` alone, with no `node_modules` beside it, see
[Self-contained builds](/docs/4.1/self-contained-builds).

## Configuration and secrets

The bot reads `DISCORD_TOKEN`, and whatever else your code needs, from the environment. A `.env` file beside
`dist` works, and so does setting the variables in the service manager or container, where a file is one
more thing to copy and protect. `import 'dotenv/config'` in `meocord.config.ts` leaves variables that are
already set alone, so the environment wins over the file.

Keep the token out of the image, the repository and the logs. [Security](/docs/4.1/security) covers the
rest.

## Docker

Build inside the image, so native addons are compiled for its platform, and ship only what runs:

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx meocord build --prod

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER node
CMD ["node", "dist/main.js"]
```

Pass the token at run time, never as a build argument, which stays in the image's history:

```bash
docker run --env-file .env my-bot
```

`docker stop` waits 10 seconds before killing the process, the same as the bot's default `shutdownTimeout`;
give it a little more with `--stop-timeout 15`, or `stop_grace_period: 15s` in Compose. Keep `.env`,
`node_modules` and `dist` out of the build context with a `.dockerignore`. Both stages use the
same base image on purpose: a native addon built on Debian does not load on Alpine, and the reverse.

## systemd

On a server of your own, a unit restarts the bot when it crashes and starts it at boot:

```ini
# /etc/systemd/system/my-bot.service
[Unit]
Description=My Discord bot
After=network-online.target
Wants=network-online.target

[Service]
User=bot
WorkingDirectory=/srv/my-bot
EnvironmentFile=/srv/my-bot/.env
ExecStart=/usr/bin/node dist/main.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=15

[Install]
WantedBy=multi-user.target
```

Enable it with `systemctl enable --now my-bot`, and read its logs with `journalctl -u my-bot`. A bot that
cannot log in, with a wrong token for instance, exits with code 1. `Restart=on-failure` retries it, and
systemd stops after a few failures in a row, rather than retrying a bad token forever. Run it as a user of
its own, which owns nothing but the bot's folder.

## pm2

```bash
pm2 start dist/main.js --name my-bot --kill-timeout 12000
pm2 save
```

Start it from the project root, or set `cwd` in an ecosystem file: the bot finds `.env` and
`dist/meocord.config.mjs` from the working directory. pm2 waits 1.6 seconds for a process to stop by default;
`--kill-timeout` gives the bot's [`onShutdown` hooks](/docs/4.1/lifecycle-hooks#onshutdown) longer than
`shutdownTimeout`, 10 seconds by default.

## Registering commands on deploy

A production start registers every command, which Discord applies idempotently, so most deploys need
nothing more. With several replicas, or to keep registration out of startup, set `commands.register` to `false` and run
`npx meocord register --build` once per deploy, from CI for instance.
[Registering commands](/docs/4.1/command-registration) covers the scopes.

## Updating

Build the new version, then restart. Discord holds interactions for three seconds, so a click during the
restart can fail. `@Defer` shortens that window for slow handlers, but nothing closes it; restart when the bot
is quiet if that matters. Buttons posted before the update keep their custom IDs, so keep the patterns they
use routed, or answer stale ones with an [exception filter](/docs/4.1/exception-filters).

## Stopping

`meocord start` passes SIGINT and SIGTERM on to the bot, so it shuts down cleanly whether the signal comes
from a terminal, Docker, pm2 or systemd. A second signal more than a second after the first is passed on too,
and if the bot is still running two seconds later, `start` kills it and exits 1.

In a container, `CMD ["node", "dist/main.js"]` is the lean choice: the bot is the only process, and it
receives the signal itself. The config is compiled into `dist`, so `node dist/main.js` loads it as `start`
does.

## Which runtime the bot runs on

`start` runs the bot on the runtime you launched it with, with nothing to configure: `bun run start` runs
`dist/main.js` under bun, and `npm run start` under node. When the CLI itself runs on node, the runner that
launched it decides: `bun run` points `npm_execpath` at its own binary, and npm, pnpm and yarn at a `.js`
file, which falls through to node.

This decides more than tidiness. It spares a bun-only image a second runtime just to launch, and it decides
the allocator, which matters for a bot doing heavy native work such as canvas rendering. Development runs
the bundle through the same command, so the runtime in `--dev` is the one that ships.

To pin a binary, set `MEOCORD_RUNTIME`:

```bash
MEOCORD_RUNTIME=/usr/local/bin/bun npm run start
```

## The CLI on bun

The runtime above is the bot's. The CLI's own process is chosen by its `#!/usr/bin/env node` line, which
stays as it is because npm on Windows builds its `.cmd` launcher from it. On a machine with no node, tell bun
to ignore the line, per command with `bun --bun meocord start --prod`, or once for the project:

```toml
# bunfig.toml
[run]
bun = true
```

Then `bun run start` runs the CLI and the bot on bun, and node need not exist.
