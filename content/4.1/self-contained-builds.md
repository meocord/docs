---
id: self-contained-builds
title: Self-contained builds
section: Shipping
order: 63
---

By default, `dist/main.js` imports its dependencies at runtime, which is why the server needs `node_modules`.
With `bundleDependencies`, the build puts everything the bot needs inside `dist` instead:

::example{file="config/self-contained.meocord.config.ts" region="config"}

Deploying is then copying `dist/`, with no install step:

```text
dist/
├── main.js
├── assets/
├── node_modules/          (native addons only, if you use any)
├── package.json
└── meocord.platform.json  (if there are native addons)
```

## Native addons

Plain JavaScript dependencies are bundled into `main.js`. Native addons, packages that ship a compiled
`.node` binary such as `sharp`, canvas bindings or database drivers, cannot be. MeoCord finds them while
building, keeps them out of the bundle, and copies each, with its platform binary and what it needs at
runtime, into `dist/node_modules`. There is nothing to list; the build names what it packed:

```text
Native addons packed into dist: meo-canvas, sharp
dist/node_modules holds 7 packages; nothing else to install.
```

Only the binaries for the platform building are copied, going by the `os`, `cpu` and `libc` each platform
package declares, so a glibc build carries no musl binaries even where both were installed.

**Build on the platform you deploy to.** A compiled binary loads only on the operating system, CPU and C
library it was built for: a build made on a Mac carries macOS binaries, and a Debian (glibc) binary does not
load on Alpine (musl). For a container, run `meocord build` inside the image. The build records its platform
in `meocord.platform.json`, and a bot started elsewhere stops before going online with a message naming
both.

## Externals

`externals` keeps a module out of the bundle for any other reason; with `bundleDependencies`, those are
copied into `dist/node_modules` too. A package a dependency only tries to load, such as `supports-color`,
belongs in `optionalExternals`: see [Optional dependencies](/docs/4.1/configuration#optional-dependencies).
discord.js's own optional accelerators, `zlib-sync`, `bufferutil` and `utf-8-validate`, are always treated
that way.

## On bun

With no `node_modules` in reach, bun downloads any package the moment something imports it. `meocord start`
passes `--no-install` for you; launching the bundle yourself, pass it too:

```dockerfile
CMD ["bun", "--no-install", "dist/main.js"]
```
