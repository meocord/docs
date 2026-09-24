---
id: cli-reference
title: "CLI Reference"
order: 6
source: readme@4.1.0-beta.0
---

```shell
npx meocord --help
```

| Command    | Alias | Description                                                          |
| ---------- | ----- | -------------------------------------------------------------------- |
| `create`   | —     | Scaffold a new MeoCord application                                   |
| `build`    | —     | Compile the application via Rsbuild                                  |
| `start`    | —     | Start the application                                                |
| `register` | —     | Register the commands, without starting the bot                      |
| `generate` | `g`   | Scaffold controllers, services, guards, interceptors, filters, pipes |
| `show`     | —     | Display framework info                                               |

Every command's own flags:

| Command    | Flags                                                           |
| ---------- | --------------------------------------------------------------- |
| `create`   | `--use-npm` · `--use-yarn` · `--use-pnpm` · `--use-bun`         |
| `build`    | `-d, --dev` · `-p, --prod`                                      |
| `start`    | `-b, --build` · `-d, --dev` · `-p, --prod` · `--force-register` |
| `register` | `-b, --build` · `-d, --dev` · `-g, --guild <id>`                |
| `show`     | `-w, --warranty` · `-c, --license`                              |
| `generate` | see the sub-commands below                                      |

`meocord -V` / `--version` prints the installed version.

`build` and `start` default to development; `-p` wins when both `-d` and `-p` are given. `start --dev` builds as it starts and on every change, so `--build` only matters with `--prod`.

`build`, `start` and `register` check `meocord.config.ts` before doing anything: one that fails to load stops them with the file and line, an option of the wrong type stops them with a list of every problem, and an option MeoCord does not know is reported as a warning. Every failure exits with code 1.

`start` accepts one environment variable, `MEOCORD_RUNTIME`, which pins the binary the application is run with — see [Which runtime the bot runs on](/docs/4.1/deployment#which-runtime-the-bot-runs-on).

```shell
npx meocord build --prod          # production build
npx meocord start --dev           # dev mode with live-reload
npx meocord start --build --prod  # production build + start
```

### Generators

| Sub-command   | Alias | Generates                           |
| ------------- | ----- | ----------------------------------- |
| `controller`  | `co`  | a controller, its spec, its builder |
| `service`     | `s`   | a service and its spec              |
| `guard`       | `gu`  | a guard and its spec                |
| `interceptor` | `i`   | an interceptor and its spec         |
| `filter`      | `f`   | an exception filter and its spec    |
| `pipe`        | `pi`  | a pipe and its spec                 |

#### Controllers

```shell
npx meocord g co <type> <name>
```

`<type>` is one of:

`button` · `modal-submit` · `select-menu` · `user-select-menu` · `role-select-menu` · `mentionable-select-menu` · `channel-select-menu` · `reaction` · `message` · `slash` · `autocomplete` · `context-menu` · `primary-entry-point`

Each one lands in its own directory, named after the type:

```
src/controllers/<type>/
├── <name>.<type>.controller.ts
├── <name>.<type>.controller.spec.ts
└── builders/<name>.builder.ts     # slash, context-menu and primary-entry-point only
```

A builder is generated only for the three types Discord registers by name. Everything else is addressed by `customId` or, for autocomplete, by the command path it completes — there is nothing to register.

Each controller gets its own builder, `<Name>CommandBuilder`, and registers a command named after it: `npx meocord g co slash Greeting` registers `/greeting`. A nested name uses its whole path, so `admin/ban` registers `/admin-ban` — Discord command names are global to the application, while folders only keep files apart. An autocomplete controller completes the slash command of the same name.

Generating never overwrites. If any file it would write already exists, it refuses, names the files, and writes nothing.

`<name>` may contain `/` to nest: `npx meocord g co button "admin/ban"` writes into `src/controllers/button/admin/`. Names are paths inside that folder: `..`, a leading `/` and drive letters are refused. On Windows, `\` separates folders too. Run generators from your project's root, where its `package.json` is.

Directory layout is organisational only. Controllers are wired up by the `controllers` array on `@MeoCord()`, not by where they sit on disk.

---
