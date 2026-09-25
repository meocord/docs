---
id: configuration
title: Configuration
section: Core
order: 10
---

A MeoCord project is configured in `meocord.config.ts` at its root. The build compiles it along with the
bot, and the bot reads the compiled copy when it starts.

::example{file="config/basic.meocord.config.ts" region="config"}

## Options

| Option               | Default | What it does                                                                                                       |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------ |
| `discordToken`       | none    | The bot token. Read it from the environment rather than writing it here.                                           |
| `appName`            | none    | Shown in log lines.                                                                                                |
| `rsbuild`            | none    | `(config) => config`: adjusts the Rsbuild configuration the bot is built with.                                     |
| `bundleDependencies` | `false` | Puts everything the bot needs inside `dist/`, native addons included, so it runs without `node_modules`.           |
| `externals`          | `[]`    | Modules to keep out of the bundle. Native addons are found without being listed.                                   |
| `optionalExternals`  | `[]`    | Packages a dependency tries to load and runs without, such as `supports-color`.                                    |
| `shutdownTimeout`    | `10000` | Milliseconds shutdown waits for the `onShutdown` hooks, all of them together.                                      |
| `commands`           | global  | Where commands are registered, and whether at startup: see [Registering commands](/docs/4.1/command-registration). |
| `sharding`           | none    | Splits the gateway connection into shards.                                                                         |

`build`, `start` and `register` check the file first. An option of the wrong type stops them with a list
of every problem; an option MeoCord does not know, often a typo, is reported as a warning.

## The build hook

MeoCord builds with [Rsbuild](https://rsbuild.rs). The `rsbuild` hook receives its configuration and
returns it, modified. Some things need no rule of your own:

- **Images, fonts, SVG and media** are emitted to `dist/assets/`, and importing one gives its absolute path
  on disk, ready for `fs`, a canvas or a Discord attachment. Nothing is inlined as a data URI.
- **Asset file names:** `output.filename.image`, and `svg`, `font` and `media`, accept a function, for two
  files that share a name in different folders.
- **Raw bundler rules** go through `tools.rspack`, as in the example above.
- **Source maps:** `source-map` in production and `cheap-module-source-map` in development, so a stack trace
  points into your source. Change them with `output.sourceMap.js`. An `eval` devtool, set there or through
  `tools.rspack`, is built as the same map without the eval, `eval-source-map` as `source-map` and plain
  `eval` as none, with a warning: the bundle reads `import.meta`, which a module evaluated from a string
  cannot. Set the non-eval devtool yourself to silence the warning.

## Optional dependencies

Some dependencies try to load a package and carry on without it: `debug`, which axios brings in, probes for
`supports-color` inside a `try`. With `bundleDependencies` on, each such package makes every build warn. List
it in `optionalExternals`: it stays a `require` where the dependency calls it, so a missing package is caught
by the dependency, and it is copied into `dist/node_modules` when it is installed. Do not also list it in
`externals`, which would load it before the bot and fail when it is missing; MeoCord warns if you do.

## Environment variables

Load `.env` in `meocord.config.ts`, as the generated one does with `import 'dotenv/config'`, not in
`main.ts`. The build runs the config before `main.ts`, so every value it loads is set by the time
`@MeoCord({...})` and the rest of your modules read `process.env`, however the bot is started:
`meocord start`, `node dist/main.js`, bun, pm2 or Docker.

To keep a file per environment, put the choice in a module the config imports:

::example{file="config/load-env.ts" region="load-env"}

::example{file="config/env.meocord.config.ts" region="config"}

```bash
APP_ENV=staging node dist/main.js
```

Start the bot from the project root: the `.env` files and `dist/meocord.config.mjs` are both found from the
working directory, so set `cwd` in pm2 and `WORKDIR` in a Dockerfile.
