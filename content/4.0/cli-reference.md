---
id: cli-reference
title: "CLI Reference"
order: 6
source: readme@4.0.0
---

```shell
npx meocord --help
```

| Command    | Alias | Description                            |
| ---------- | ----- | -------------------------------------- |
| `create`   | —     | Scaffold a new MeoCord application     |
| `build`    | —     | Compile the application via Rsbuild    |
| `start`    | —     | Start the application                  |
| `generate` | `g`   | Scaffold controllers, services, guards |
| `show`     | —     | Display framework info                 |

Every command's own flags:

| Command    | Flags                                                   |
| ---------- | ------------------------------------------------------- |
| `create`   | `--use-npm` · `--use-yarn` · `--use-pnpm` · `--use-bun` |
| `build`    | `-d, --dev` · `-p, --prod`                              |
| `start`    | `-b, --build` · `-d, --dev` · `-p, --prod`              |
| `show`     | `-w, --warranty` · `-c, --license`                      |
| `generate` | see the sub-commands below                              |

`meocord -V` / `--version` prints the installed version.

`start` accepts one environment variable, `MEOCORD_RUNTIME`, which pins the binary the application is run with — see [Which runtime the bot runs on](/docs/4.0/deployment#which-runtime-the-bot-runs-on).

```shell
npx meocord build --prod          # production build
npx meocord start --dev           # dev mode with live-reload
npx meocord start --build --prod  # production build + start
```

### Generators

| Sub-command  | Alias | Generates                           |
| ------------ | ----- | ----------------------------------- |
| `controller` | `co`  | a controller, its spec, its builder |
| `service`    | `s`   | a service and its spec              |
| `guard`      | `gu`  | a guard and its spec                |

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

`<name>` may contain `/` to nest: `npx meocord g co button "admin/ban"` writes into `src/controllers/button/admin/`.

Directory layout is organisational only. Controllers are wired up by the `controllers` array on `@MeoCord()`, not by where they sit on disk.

---
