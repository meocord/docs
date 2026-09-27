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
| `logLevel`           | `'log'` | The least severe line the bot prints; `'debug'` in development. See [Log level](#log-level).                       |
| `sourceMappedStacks` | `true`  | Stack traces name your source files and lines. See [Stack traces](#stack-traces).                                  |
| `rsbuild`            | none    | `(config) => config`: adjusts the Rsbuild configuration the bot is built with.                                     |
| `bundleDependencies` | `false` | Puts everything the bot needs inside `dist/`, native addons included, so it runs without `node_modules`.           |
| `externals`          | `[]`    | Modules to keep out of the bundle. Native addons are found without being listed.                                   |
| `optionalExternals`  | `[]`    | Packages a dependency tries to load and runs without, such as `supports-color`.                                    |
| `shutdownTimeout`    | `10000` | Milliseconds shutdown waits for the `onShutdown` hooks, all of them together.                                      |
| `commands`           | global  | Where commands are registered, and whether at startup: see [Registering commands](/docs/4.1/command-registration). |
| `sharding`           | none    | Splits the gateway connection into shards.                                                                         |

`build`, `start` and `register` check the file first. An option of the wrong type stops them with a list
of every problem; an option MeoCord does not know, often a typo, is reported as a warning.

## Log level

`Logger`, and every line MeoCord logs through it, prints from a level up. `[DEBUG]` lines show in development, where
`NODE_ENV` is `development` as under `meocord start --dev`, and are hidden everywhere else, so a production log shows
what went wrong without the raw errors and stacks behind it.

| Level      | Prints                                                                     |
| ---------- | -------------------------------------------------------------------------- |
| `'debug'`  | everything                                                                 |
| `'log'`    | `[LOG]`, `[WARN]` and `[ERROR]`: `log`, `info`, `verbose`, `warn`, `error` |
| `'warn'`   | `[WARN]` and `[ERROR]`                                                     |
| `'error'`  | `[ERROR]` only                                                             |
| `'silent'` | nothing                                                                    |

Set `logLevel` in `meocord.config.ts` to choose another, or `MEOCORD_LOG_LEVEL` for one run without a rebuild. The
variable wins over the config:

```bash
MEOCORD_LOG_LEVEL=debug node dist/main.js
```

- `MEOCORD_LOG_LEVEL` is read in any case, so `DEBUG` is `debug`. One that names no level is reported once, even
  under a level that hides warnings, and the config or the default applies.
- The level is read once, when the first line is logged, so a busy bot never looks it up again.
- `logLevel` is the built bot's. The CLI and your tests print by `MEOCORD_LOG_LEVEL` and the default alone, whatever
  a previous build left in `dist`.

## The build hook

MeoCord builds with [Rsbuild](https://rsbuild.rs). The `rsbuild` hook receives its configuration and
returns it, modified. Some things need no rule of your own:

- **Images, fonts, SVG and media** are emitted to `dist/assets/`, and importing one gives its absolute path
  on disk, ready for `fs`, a canvas or a Discord attachment. Nothing is inlined as a data URI.
- **Asset file names:** `output.filename.image`, and `svg`, `font` and `media`, accept a function, for two
  files that share a name in different folders.
- **Raw bundler rules** go through `tools.rspack`, as in the example above.
- **Source maps:** `source-map` in production and `cheap-module-source-map` in development, so a
  [stack trace](#stack-traces) points into your source. Change them with `output.sourceMap.js`. An `eval` devtool, set there or through
  `tools.rspack`, is built as the same map without the eval, `eval-source-map` as `source-map` and plain
  `eval` as none, with a warning: the bundle reads `import.meta`, which a module evaluated from a string
  cannot. Set the non-eval devtool yourself to silence the warning.

## Stack traces

A stack trace names your source, such as `src/services/profile.service.ts:42:11`, not the bundle, on Node and Bun
alike. The build writes `dist/main.js.map` beside the bundle, in development and production, and:

- `meocord start` runs Node with `--enable-source-maps`, so Node maps each stack itself. The shard processes it
  starts inherit the flag.
- A bundle started any other way, with `node dist/main.js` in a Docker `CMD`, under pm2, or with Bun, which applies
  no source map to a bundle, maps its stacks through `Error.prepareStackTrace`. The map is read the first time a stack
  needs it, and each frame keeps the runtime's format, `at fn (/abs/path/src/file.ts:line:col)`, so a tool that parses
  `error.stack` reads it as before.
- A hook already set on `Error.prepareStackTrace`, such as a preloaded error tracker's, receives the mapped call
  sites. One set later replaces MeoCord's unless it calls the hook it found.
- Bun reports a call's column further along than Node does. In a minified production bundle, a frame for a call can
  map to the statement just before it, one line up; the frame that threw maps exactly.

Set `sourceMappedStacks: false` when an error tracker applies uploaded source maps to the bundle's own positions, or
you ship a source mapper of your own. `meocord start` then passes no flag, and the bundle installs no hook.

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
