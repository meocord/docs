---
id: deployment
title: "Deployment"
order: 24
source: readme@4.1.0-beta.0
---

Install all dependencies and build for production:

```shell
npm ci && npx meocord build --prod
```

Strip dev dependencies:

```shell
npm ci --omit=dev      # npm
yarn install --production  # yarn
pnpm install --prod    # pnpm
bun install --production   # bun
```

Required files on the server:

```
dist/
node_modules/   (production only)
package.json
.env            (if used)
<lockfile>
```

Start in production:

```shell
npx meocord start --prod
```

`meocord start` passes SIGINT and SIGTERM on to the bot, so it shuts down cleanly whether the signal comes from a terminal, Docker, pm2 or systemd. A second signal more than a second after the first is passed on too, and if the bot is still running two seconds later, `start` kills it and exits 1. In a container, `CMD ["node", "dist/main.js"]` is the lean choice: the bot is the only process, and it receives the signal itself.

### Self-contained builds

By default `dist/main.js` imports its dependencies at runtime, which is why the server needs `node_modules`. Set `bundleDependencies` and the build puts everything the bot needs inside `dist` instead:

```typescript
import { type MeoCordConfig } from 'meocord/interface'

export default {
  discordToken: process.env.DISCORD_TOKEN!,
  bundleDependencies: true,
} satisfies MeoCordConfig
```

Deploying is then copying `dist/` — no `node_modules` beside it, no install step:

```
dist/
├── main.js
├── assets/
├── node_modules/          (native addons only, if you use any)
├── package.json
└── meocord.platform.json  (if there are native addons)
```

Plain JavaScript dependencies are bundled into `main.js`. **Native addons** — packages that ship a compiled `.node` binary, like `sharp`, canvas bindings or database drivers — cannot be inlined into JavaScript, so MeoCord finds them itself while building, keeps them out of the bundle, and copies each one, with its platform binary and what it needs at runtime, into `dist/node_modules`. There is nothing to list: the build tells you which it packed. Only binaries for the platform building are copied, going by the `os`, `cpu` and `libc` each platform package declares — so a glibc build carries no musl binaries even where the package manager installed both, as bun does.

```
Native addons packed into dist: meo-canvas, sharp
dist/node_modules holds 7 packages; nothing else to install.
```

**Build on the platform you deploy to.** A compiled binary only loads on the operating system, CPU and C library it was built for — a build made on a Mac carries macOS binaries, and a Debian (glibc) binary does not load on Alpine (musl). For a container, run `meocord build` inside the image. The build records its platform in `meocord.platform.json`, and a bot started somewhere else stops before going online with a message naming both, instead of failing on the first command that renders an image.

Use `externals` for anything you want kept out of the bundle for another reason; those are copied into `dist/node_modules` too. A package a dependency only tries to load, such as `supports-color`, belongs in [`optionalExternals`](/docs/4.1/configuration#meocordconfigts) instead: it is packed if you installed it and skipped by the dependency if you did not, as discord.js's own optional accelerators — `zlib-sync`, `bufferutil`, `utf-8-validate` — always are.

**On bun, keep it from installing at runtime.** With no `node_modules` in reach, bun downloads any package the moment something imports it. `meocord start` passes `--no-install` for you. If you launch the bundle yourself, pass it too:

```dockerfile
CMD ["bun", "--no-install", "dist/main.js"]
```

### Which runtime the bot runs on

`start` runs the bot on **the runtime you launched it with**. There is nothing to configure and no config key to set — if you typed `bun`, you get a bun process:

```shell
bun run start          # dist/main.js runs under bun
npm run start          # dist/main.js runs under node
```

Two signals decide it, most explicit first: the runtime executing the CLI, and — when the CLI itself was handed to node — the runner that launched it. `bun run` honours the bin's `#!/usr/bin/env node` shebang, so bun sets `npm_execpath` to its own binary and that is what the bot is spawned with. npm, pnpm and yarn point it at a `.js` file instead, which cannot run the bundle, so those fall through to node as expected.

That matters for more than tidiness. Pinning `node` would oblige a bun-only image to install a second runtime purely to launch, or to carry `--bun` on every command. It also decides the allocator: for a bot doing heavy native work — canvas rendering through a napi module, say — glibc's malloc and bun's mimalloc produce very different resident-memory curves on the same workload, because they differ in how eagerly freed pages go back to the OS.

Development works the same way. The watcher runs the bundle through the same command production does, so a runtime that works in `--dev` cannot quietly differ from the one that ships.

<details>
<summary><b>Running the CLI itself on bun</b></summary>

The resolution above decides what the _bot_ runs on. The CLI process is decided earlier,
by the interpreter line `#!/usr/bin/env node`, which nothing in the package can influence
— it is read before any of the program exists. On a machine with no node at all,
invoking the CLI directly fails before it starts:

```
$ meocord start --prod
env: node: No such file or directory
```

That line stays as it is because Windows depends on it: npm there never runs the file
through its shebang, it parses the line and writes a `.cmd` invoking the program named in
it. `#!/usr/bin/env node` yields `node`; anything else yields a program Windows cannot
resolve.

So on a bun-only image, tell bun to ignore the line. Either per command:

```shell
bun --bun meocord start --prod
```

or once for the project, which is what a bun-only Dockerfile wants:

```toml
[run]
bun = true
```

Then plain `bun run start` runs the CLI and the bot on bun, and node need not exist.

</details>

<details>
<summary><b>Pinning a specific binary</b></summary>

To override both signals — a particular install, or a different runtime for comparison — set `MEOCORD_RUNTIME`:

```shell
MEOCORD_RUNTIME=/usr/local/bin/bun npm run start
```

</details>

### Sharding

Discord requires a bot in more than about 2,500 servers to split its gateway connection into shards. Turn it on in `meocord.config.ts`:

```typescript
import { type MeoCordConfig } from 'meocord/interface'

export default {
  discordToken: process.env.DISCORD_TOKEN!,
  sharding: { shards: 'auto' }, // or a number
} satisfies MeoCordConfig
```

By default every shard runs in one process, in one client: one set of services, `onReady` once, commands registered once, and nothing else changes. Unset, `sharding` leaves `clientOptions.shards` as you set it.

For a bot that needs more than one CPU core, `mode: 'process'` runs each shard in a process of its own. Start the bot as usual — `meocord start`, `node dist/main.js`, bun, pm2 or Docker all behave the same — and the first process becomes a manager that:

- registers the commands once, over REST, then spawns the shards one after another from the built bundle, with the same runtime flags (such as bun's `--no-install`);
- restarts a shard that exits, waiting 1 second, then 2, 4 and so on up to a minute, and from the start again once a shard has stayed up for five minutes;
- stops everything and exits 1 when a shard cannot log in because the token is invalid or Discord refuses its intents, as disallowed or invalid, instead of restarting it forever, and says which privileged intents to enable;
- on SIGINT or SIGTERM, asks each shard to shut down through its `onShutdown` hooks, waits up to `shutdownTimeout` plus five seconds, and kills any shard still running — on Windows too. A second signal more than a second after the first kills them at once.

Each shard process runs the whole application with its own container, and its lifecycle hooks run in it; `onReady`'s `primary` is `true` only in the process running shard 0. Under `meocord start --dev`, process mode is off and every shard runs in one process, so the watcher restarts a single process; set `sharding.development: true` to run separate processes there too.

To reach every shard, inject `ShardContext` from `meocord/core`:

```typescript
import { Service } from 'meocord/decorator'
import { ShardContext } from 'meocord/core'
import { Client } from 'discord.js'

@Service()
export class StatsService {
  constructor(
    private readonly shards: ShardContext,
    private readonly client: Client,
  ) {}

  guildCount() {
    return this.client.guilds.cache.size
  }

  async totalGuilds() {
    const results = await this.shards.call(StatsService, 'guildCount')
    return results.reduce((sum, result) => sum + (result.ok ? result.value : 0), 0)
  }
}
```

`call(Service, 'method', ...args)` runs the method in every process, each resolving the service from its own container — the class you pass in this process, and a class of the same name in another, since only JSON crosses between them, so with process sharding the bot refuses to start when two controllers or services share a name — and resolves to one `{ shardIds, ok, value | error }` per process: one per shard with process sharding, one in all otherwise. Arguments and results cross processes as JSON. A process that throws, lacks the service or takes more than 10 seconds gives an error result instead of failing the others. `ids`, `count` and `isPrimary` describe the shards of this process. `broadcastEval` is there as well, but it turns its function into a string, which a minified bundle can break; prefer `call`.

---
