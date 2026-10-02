---
id: configuration
title: Configuration
chapter: structure
order: 2
summary: Configure how your bot is built and started, what it logs, and the settings your own code reads.
learn:
  - Set the token, logging and build options in meocord.config.ts
  - Load .env files, one per environment
  - Read and check your own settings once, before the bot logs in
  - Tell the build's options from the app's
requires: [services]
api: [configuration/MeoCordConfig, decorators/MeoCord]
since: 4.0.0
---

A MeoCord bot has two kinds of settings. `meocord.config.ts`, at the project's root, holds how the bot is built and
started: its token, what it logs, how it's bundled, where its commands are registered.
[`@MeoCord({...})`](api:decorators/MeoCord) holds what the app is made of: its controllers, its theme, its guards.

## When to use it

Put a setting in `meocord.config.ts` when the CLI or the process needs it before your code runs: the token, the log
level, a build rule, sharding. Everything about how the bot behaves once it runs goes in `@MeoCord`, and each of
those options is taught on its own page, [listed below](#the-apps-options).

Your own values, such as a channel ID or an API key, belong in neither. Read them from the environment into a
[provider](#your-own-settings), so they're checked once and injected where they're used.

## Example

::example{file="config/logging.meocord.config.ts" region="config"}

The bot reads its token from `.env`, starts each log line with "Feedback", and prints only warnings and errors.

## How it works

`meocord build` compiles the config with the bot, into `dist/meocord.config.mjs`. When the bot starts, it loads
that compiled copy, however it's started: `meocord start`, `node dist/main.js`, bun, pm2 or Docker. Nothing in the
built bot reads `meocord.config.ts` itself.

`build`, `start` and `register` check the config first. An option of the wrong type stops them with a list of every
problem; an option MeoCord doesn't know, often a typo, is reported as a warning.

`meocord start --dev` watches `meocord.config.ts` and reloads it on every change. A production bot keeps the config
it was built with, until the next `meocord build --prod`.

## Options

| Option               | Default | What it does                                                                                                          |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `discordToken`       | none    | The bot token. Read it from the environment rather than writing it here.                                              |
| `appName`            | none    | Starts every log line.                                                                                                |
| `logLevel`           | `'log'` | The least severe line the bot prints; `'debug'` in development. See [Logging](#logging).                              |
| `sourceMappedStacks` | `true`  | Stack traces name your source files and lines, not the bundle's. See [Stack traces](#stack-traces).                   |
| `shutdownTimeout`    | `10000` | Milliseconds shutdown waits for the `onShutdown` hooks, all of them together.                                         |
| `commands`           | global  | Where commands are registered, and whether at startup: see [Slash commands](guide:slash-commands).                    |
| `sharding`           | none    | Splits the gateway connection into shards: see [Sharding](guide:sharding).                                            |
| `rsbuild`            | none    | `(config) => config`: adjusts the Rsbuild configuration the bot is built with. See [the build hook](#the-build-hook). |
| `bundleDependencies` | `false` | Puts everything the bot needs inside `dist/`, so it runs without `node_modules`.                                      |
| `externals`          | `[]`    | Modules to keep out of the bundle.                                                                                    |
| `optionalExternals`  | `[]`    | Packages a dependency tries to load and runs without, such as `supports-color`.                                       |

The last two matter mostly for a bundled bot: see [Self-contained builds](guide:self-contained-builds).

Each option, with its full type, its default and the version it first appeared in, is listed in the
[meocord.config.ts reference](guide:config-reference).

## Logging

`logLevel` is the least severe line [`Logger`](api:utilities/Logger) prints, MeoCord's own lines included:

| Level      | Prints                         |
| ---------- | ------------------------------ |
| `'debug'`  | everything                     |
| `'log'`    | everything but `[DEBUG]` lines |
| `'warn'`   | warnings and errors            |
| `'error'`  | errors only                    |
| `'silent'` | nothing                        |

Without it, the bot prints `'debug'` in development, as under `meocord start --dev`, and `'log'` otherwise.

To change the level for one run, without a rebuild, set `MEOCORD_LOG_LEVEL`. It wins over `logLevel`, ignores letter
case, so `DEBUG` works, and can be set in `.env`. An unknown value is ignored, with a warning. `logLevel` applies to
the built bot; the CLI's own output and your tests read only the variable. The level is read once, when the first
line is logged, so a busy bot never looks it up again, and setting the variable from code after that changes nothing.

```bash
MEOCORD_LOG_LEVEL=debug node dist/main.js
```

`logger.info()` and `logger.verbose()` print at the `'log'` level, tagged `[INFO]` and `[VERBOSE]`, so a filter on
`[LOG]` doesn't match them. A line is in colour on a terminal and plain where the output isn't one, such as a file or a
log collector, objects included. Set `FORCE_COLOR=1` to keep the colour where your log viewer shows it.

### Stack traces

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

## Environment variables

Load `.env` in `meocord.config.ts`, not in `main.ts`. The bot loads its config before `main.ts`, so every value the
files set is there by the time `@MeoCord({...})` and the rest of your modules read `process.env`. A new app's config
reads the files Bun reads for its mode: the production files in a production build and the development files in a
development build, however the bot is started, on node and Bun alike, and `.env.test` where it runs from source under
`NODE_ENV=test`. For an environment of your own, pick the files with a variable of your own, as below:

::example{file="config/env-files.meocord.config.ts" region="config"}

The mode is `NODE_ENV`, `development` unless it's set: `meocord start --dev` builds in development and runs the bot as
development, whatever `NODE_ENV` the shell holds, so it reads and watches the development files, and
`meocord build --prod` writes `production` into the config it compiles. A more specific file wins, and a variable the
shell sets wins over every file, so `.env.local` can hold your own values beside the committed `.env.development`.

To pick files by something other than `NODE_ENV`, such as a staging server, put the choice in a module the config
imports:

::example{file="config/load-env.ts" region="load-env"}

::example{file="config/env.meocord.config.ts" region="config"}

```bash
APP_ENV=staging node dist/main.js
```

Start the bot from the project root: the `.env` files are read from the working directory, so set `cwd` in pm2 and
`WORKDIR` in a Dockerfile. `dist/meocord.config.mjs` is found beside the bundle wherever the bot starts.

## Your own settings

A value read from `process.env` wherever it's needed is checked nowhere: a missing channel ID shows up as a failed
call, long after the bot started. Read the environment once, in a factory, and check it there:

::example{file="services/settings/settings.ts" region="settings"}

Provide it on the app, and inject it by its token:

::example{file="app-with-settings.ts" region="app"}

::example{file="services/settings/settings.ts" region="inject"}

MeoCord runs every factory before the bot logs in. When a value is missing, the bot logs the factory's error, naming
`Settings` and each value, and stops. A test gives the loader an environment of its own:

::example{file="services/settings/settings.spec.ts" region="spec"}

A test of `ReportService` provides `SETTINGS` with `useValue` instead, as [Services](guide:services#providers) shows.

## The app's options

`@MeoCord({...})` takes `controllers` and `clientOptions`, which every bot needs, and these, each taught on its own
page:

| Options                                                           | Taught in                                    |
| ----------------------------------------------------------------- | -------------------------------------------- |
| `services`, `providers`                                           | [Services and injection](guide:services)     |
| `theme`, `themeFor`, `themeCache`, `themeForTimeoutMs`            | [Theming](guide:theming)                     |
| `i18n`                                                            | [Localisation](guide:localisation)           |
| `presenter`                                                       | [Presenters](guide:presenters)               |
| `warnUnanswered`                                                  | [Answering with respond()](guide:responses)  |
| `messages`                                                        | [Message commands](guide:message-commands)   |
| `guards`                                                          | [Guards](guide:guards)                       |
| `interceptors`                                                    | [Interceptors](guide:interceptors)           |
| `filters`                                                         | [Exception filters](guide:exception-filters) |
| `cooldownStore`, `cooldownStoreFailure`, `cooldownStoreTimeoutMs` | [Cooldowns](guide:cooldowns)                 |
| `observers`                                                       | [Observers](guide:observers)                 |

To share options between app classes, type the object as [`MeoCordOptions`](api:configuration/MeoCordOptions) from
`meocord/decorator`. Its `guards`, `interceptors` and `filters` are checked against the classes they hold, as in
`@MeoCord` itself, so a filter in `guards` is refused. Typed plainly, it takes any `params` on a `{ provide, params }`
entry. To have those checked too, give the entries as its type arguments, guards, then interceptors, then filters, as in
`MeoCordOptions<[{ provide: typeof ChannelGuard }]>`, or write them in `@MeoCord({...})`.

`activities` lists the bot's statuses, shown in order: the first once it's ready, then the next every 10 seconds,
starting again after the last.

## The build hook

MeoCord builds with [Rsbuild](https://rsbuild.rs). The `rsbuild` hook receives its configuration and returns it,
modified:

::example{file="config/basic.meocord.config.ts" region="config"}

Some things need no rule of your own:

- **Imported images, fonts, SVG, media, PDFs, text files** and the other kinds `src/types/assets.d.ts` declares as a
  path are emitted to `dist/assets/` under their own names, and importing one gives its absolute path on disk, ready
  for `fs`, a canvas or a Discord attachment. A file of another kind, JSON and WebAssembly aside, which the build
  handles itself, needs a rule of its own in `tools.rspack`, as Markdown does above. The path is set as the bot starts,
  from where its `dist` is, so a build made in CI or another folder finds its assets. Nothing is inlined as a data URI.
- **Asset file names:** two imported files of one name in different folders stop the build with Rspack's conflict
  error, naming the file. `output.filename.image`, and `svg`, `font`, `media` and `assets`, accept a function to keep
  both.
- **Raw bundler rules** go through `tools.rspack`, as above.
- **Source maps:** `source-map` in production and `cheap-module-source-map` in development. Change them with
  `output.sourceMap.js`. An `eval-…` devtool is built as the same map without the eval, and plain `eval` as none,
  with a warning: the bundle reads `import.meta`, which a module evaluated from a string can't.

## Gotchas

- **`.env` loaded in `main.ts` is too late** for the config and for `@MeoCord({...})`, which read `process.env`
  first. Load it in `meocord.config.ts`.
- **A production bot doesn't see a config change** until it's built again: run `meocord build --prod`, or
  `meocord start --build --prod`.
- **`logLevel` hides your own lines too.** `Logger` prints through it, so `'warn'` also hides your `logger.log()`
  calls.
- **The token doesn't belong in the file.** `meocord.config.ts` is committed; `.env` isn't.

## Next steps

- [Services and injection](guide:services): provide values and inject them by token.
- [Self-contained builds](guide:self-contained-builds): ship `dist/` without `node_modules`.
- [Deployment](guide:deployment): run the built bot under pm2, Docker or a host's process manager.
