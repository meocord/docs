---
id: deployment
title: 'Deployment'
order: 14
source: readme@4.0.0
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

### Self-contained builds

By default `dist/main.js` imports its dependencies at runtime, which is why the server needs `node_modules`. Set `bundleDependencies` and the build puts everything the bot needs inside `dist` instead:

```typescript
import { type MeoCordConfig } from 'meocord/interface'

export default {
  discordToken: process.env.TOKEN!,
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

Use `externals` for anything you want kept out of the bundle for another reason; those are copied into `dist/node_modules` too. discord.js's optional accelerators — `zlib-sync`, `bufferutil`, `utf-8-validate` — are never bundled, are packed if you installed them, and are simply skipped by discord.js if you did not.

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

---
