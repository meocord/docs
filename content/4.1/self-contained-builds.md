---
id: self-contained-builds
title: Self-contained builds
chapter: shipping
order: 2
summary: Build everything the bot needs into dist/, so a server runs it with no node_modules and no install step.
learn:
  - Build the bot into dist/ with its dependencies inside
  - Ship native addons, built for the platform you deploy to
  - Keep a module out of the bundle, and one a dependency only tries to load
requires: [cli, configuration]
api: [configuration/MeoCordConfig]
since: 4.1.0
---

By default, `dist/main.js` imports its dependencies when it runs, so the server needs `node_modules` beside it. With
`bundleDependencies`, the build puts everything the bot needs inside `dist/` instead, and deploying is copying one
folder.

## When to use it

- **A small image or a plain server:** `dist/` holds the bot and nothing else, with no install step and no package
  manager on the server.
- **An exact ship:** the server runs the packages the build was made with, never a newer patch resolved at install.

When the server installs its dependencies anyway, from the lockfile as [Deployment](guide:deployment) does, a regular
build is simpler, and it has no platform to match.

## Example

::example{file="config/self-contained.meocord.config.ts" region="config"}

Build it as usual, with `npx meocord build --prod`. The server needs `dist/` alone:

```text
dist/
├── main.js
├── main.js.map
├── main.js.LICENSE.txt    (in a production build)
├── meocord.config.mjs
├── package.json
├── assets/                (if the bot imports any)
├── node_modules/          (if needed: native addons, externals and installed optional externals, with what they need)
└── meocord.platform.json  (if there are native addons)
```

Start it with `node dist/main.js`, or `npx meocord start --prod` where the CLI is installed.

## How it works

Plain JavaScript dependencies are bundled into `main.js`. A native addon, a package that ships a compiled `.node`
binary such as `sharp`, a canvas binding or a database driver, can't be. The build finds each one, keeps it out of the
bundle, and copies it into `dist/node_modules`, with its platform binary and what it needs at runtime. There's nothing
to list; the build names what it packed:

```text
Native addons packed into dist: meo-canvas, sharp
dist/node_modules holds 7 packages; nothing else to install.
```

It copies only the binaries for the platform building, going by the `os`, `cpu` and `libc` each platform package
declares. So a glibc build carries no musl binaries, even where both were installed.

A pnpm project packs as an npm, yarn or bun one does. Under pnpm, each package's dependencies come from beside it in
the store, and when two packages need different versions of one dependency, each gets its own: the first
at the top of `dist/node_modules`, the other nested under the package that needs it.

## Native addons and platforms

A compiled binary loads only on the operating system, CPU and C library it was built for. A build made on a Mac
carries macOS binaries, and a Debian (glibc) binary doesn't load on Alpine (musl). Build on the platform you deploy to:
for a container, run `npx meocord build --prod` inside the image.

The build records its platform in `meocord.platform.json`. A bot started on another platform stops before it goes
online, with a message naming both.

## Externals

`externals` keeps a module out of the bundle for any other reason; with `bundleDependencies`, those named as strings
are copied into `dist/node_modules` too. A package a dependency only tries to load, such as `supports-color`, belongs in
`optionalExternals`: it's packed when it's installed, and the dependency carries on without it when it isn't. See
[the options](guide:configuration#options).

discord.js's optional accelerators, `zlib-sync`, `bufferutil` and `utf-8-validate`, are always treated that way.

## On Bun

A self-contained build runs under Bun as under Node. With no `node_modules` in reach, Bun downloads any package the
moment something imports it. `meocord start` passes `--no-install` for you; when you launch the bundle yourself, pass
it too:

```dockerfile
CMD ["bun", "--no-install", "dist/main.js"]
```

## Gotchas

- **A build from your laptop doesn't run on the server** when they differ in platform and the bot uses a native addon.
  Build where it runs, and read the startup message: it names both platforms.
- **Bun without `--no-install`** fetches a missing package at runtime instead of failing, so a bundle that lacks one
  seems to work until the network is down.

## Next steps

- [Deployment](guide:deployment): run the build in Docker, under systemd or pm2, and stop it cleanly.
- [Configuration](guide:configuration): the build's other options, and loading `.env` per environment.
- [`MeoCordConfig`](api:configuration/MeoCordConfig): every option, with its default.
