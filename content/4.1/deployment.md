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
