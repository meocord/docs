---
id: deployment
title: Deployment
chapter: shipping
order: 3
summary: Build the bot for production and run it on a server, in Docker, under systemd or pm2, stopping it cleanly.
learn:
  - Build for production and start the build on a server
  - Run the bot in Docker, under systemd or under pm2
  - Register commands, update and stop without losing work
  - Choose the runtime the bot runs on
requires: [cli, configuration, lifecycle-hooks]
api: [cli/build, cli/start, configuration/MeoCordConfig]
---

A deployed bot is a production build, its production dependencies, and the environment it reads its token from. This
page puts one on a server and keeps it running: under a container, a service manager or a process manager.

## When to use it

Deploy once the bot does what you want in your test server. For a server with no `node_modules` at all, build it
self-contained first: [Self-contained builds](guide:self-contained-builds) covers what changes, and the rest of this
page applies unchanged.

## Example

Install every dependency and build for production, then drop the development ones, and start it:

```bash
npm ci && npx meocord build --prod
npm ci --omit=dev
npx meocord start --prod
```

With yarn, the second line is `yarn install --production`; with pnpm, `pnpm install --prod`; with bun,
`bun install --production`.

## How it works

The server needs:

```text
dist/
node_modules/   (production only)
package.json
.env            (if used)
<lockfile>
```

`start --prod` runs the build in `dist/` as it is. The bot compiles `meocord.config.ts` into `dist/` as it builds, so
`node dist/main.js` starts it the same way, with nothing else to install, which suits a container.

The bot reads `DISCORD_TOKEN`, and whatever else your code needs, from the environment. A `.env` file beside `dist`
works, and so does setting the variables in the service manager or container, where a file is one more thing to copy
and protect. `import 'dotenv/config'` in `meocord.config.ts` leaves variables that are already set alone, so the
environment wins over the file.

> [!WARNING]
> Keep the token out of the image, the repository and the logs. Anyone who has it controls the bot.
> [Security](guide:security) covers the rest.

## Docker

Build inside the image, so native addons are built for its platform, and ship only what runs:

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

Pass the token when the container runs, never as a build argument, which stays in the image's history:

```bash
docker run --env-file .env my-bot
```

- **Both stages use the same base image** on purpose: a native addon built on Debian doesn't load on Alpine, and the
  reverse.
- **Keep `.env`, `node_modules` and `dist` out of the build context** with a `.dockerignore`.
- **`docker stop` waits 10 seconds** before killing the process, the same as the bot's default `shutdownTimeout`. Give
  it a little more with `--stop-timeout 15`, or `stop_grace_period: 15s` in Compose.

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

Enable it with `systemctl enable --now my-bot`, and read its logs with `journalctl -u my-bot`. A bot that can't log
in, with a wrong token for instance, exits with code 1: `Restart=on-failure` retries it, and systemd gives up after a
few failures in a row rather than retrying a bad token forever. Run it as a user of its own, which owns nothing but the
bot's folder.

## pm2

```bash
pm2 start dist/main.js --name my-bot --kill-timeout 12000
pm2 save
```

Start it from the project's root, or set `cwd` in an ecosystem file: the bot finds `.env` and
`dist/meocord.config.mjs` from the working directory. pm2 waits 1.6 seconds for a process to stop by default;
`--kill-timeout` gives the bot's [`onShutdown` hooks](guide:lifecycle-hooks#onshutdown) longer than `shutdownTimeout`.

## Registering commands on deploy

A production start registers every command, and Discord applies an unchanged set without harm, so most deploys need
nothing more. With several replicas, or to keep registering out of startup, set `commands.register` to `false`, and run
`npx meocord register --build` once per deploy, from CI for instance. [The CLI](guide:cli#registering-commands) covers
the scopes.

## Updating and stopping

Build the new version, then restart. Discord waits three seconds for an answer, so a click during the restart can fail.
[`@Defer`](guide:defer) shortens that window for a slow handler, but nothing closes it: restart when the bot is quiet if
that matters. Buttons posted before the update keep their custom IDs, so keep the patterns they use routed, or answer
stale ones with an [exception filter](guide:exception-filters).

`meocord start` passes SIGINT and SIGTERM on to the bot, so it shuts down cleanly whether the signal comes from a
terminal, Docker, pm2 or systemd. A second signal more than a second after the first is passed on too, and if the bot
is still running two seconds later, `start` kills it and exits 1. In a container, `CMD ["node", "dist/main.js"]` makes
the bot the only process, and it receives the signal itself.

## Which runtime the bot runs on

`start` runs the bot on the runtime you launched it with, with nothing to configure: `bun run start` runs
`dist/main.js` under Bun, and `npm run start` under Node. When the CLI itself runs on Node, the runner that launched it
decides: `bun run` points `npm_execpath` at its own binary, and npm, pnpm and yarn at a `.js` file, which falls through
to Node.

It decides more than tidiness. It spares a Bun-only image a second runtime just to launch, and it picks the allocator,
which matters for a bot doing heavy native work such as canvas rendering. Development runs the bundle through the same
command, so the runtime in `--dev` is the one that ships. To pin a binary, set `MEOCORD_RUNTIME`:

```bash
MEOCORD_RUNTIME=/usr/local/bin/bun npm run start
```

### The CLI on Bun

The runtime above is the bot's. The CLI's own process is chosen by its `#!/usr/bin/env node` line, which stays as it
is because npm on Windows builds its `.cmd` launcher from it. On a machine with no Node, tell Bun to ignore the line,
per command with `bun --bun meocord start --prod`, or once for the project:

```toml
# bunfig.toml
[run]
bun = true
```

Then `bun run start` runs the CLI and the bot on Bun, and Node needn't exist.

## Gotchas

- **pm2's default stop is too short** for `onShutdown` hooks: give it `--kill-timeout` above `shutdownTimeout`.
- **A Debian build doesn't load on Alpine,** and the reverse, when the bot uses a native addon. Build and run on the
  same base image.
- **A token as a Docker build argument** stays in the image's history. Pass it when the container runs.

## Build it

The feedback bot runs in your test server with `start --dev`. Put it on a server of its own. Its `.env` there holds the
three values it reads: `DISCORD_TOKEN`, the review channel's ID in `FEEDBACK_CHANNEL_ID`, and in `STAFF_ROLE_ID` the
role the staff guard checks. To copy an ID, turn on **Developer Mode** under Discord's **Advanced** settings, then
right-click the channel or role. Then build it and start it:

```bash
npm ci && npx meocord build --prod
npm ci --omit=dev
npx meocord start --prod
```

The bot logs in and registers `/feedback` everywhere it's installed. Run it from another account: the form opens, and
the report reaches the review channel.

## Next steps

- [Sharding](guide:sharding): split the bot's connection once it's in thousands of servers.
- [Security](guide:security): the token, the permissions the bot asks for, and what members send it.
- [Self-contained builds](guide:self-contained-builds): ship `dist/` alone, with no install on the server.
