---
id: cli-reference
title: The CLI
section: Shipping
order: 60
---

The `meocord` command builds, starts and registers the bot, and scaffolds its parts. `npx meocord --help`
lists the commands, and `meocord -V` prints the installed version.

| Command    | Alias | What it does                                                                        |
| ---------- | ----- | ----------------------------------------------------------------------------------- |
| `create`   | none  | Scaffolds a new MeoCord application                                                 |
| `build`    | none  | Compiles the application with Rsbuild                                               |
| `start`    | none  | Starts the application                                                              |
| `register` | none  | Registers the commands, without starting the bot                                    |
| `generate` | `g`   | Scaffolds controllers, services, guards, interceptors, filters, pipes and observers |
| `show`     | none  | Displays framework information                                                      |

| Command    | Flags                                                           |
| ---------- | --------------------------------------------------------------- |
| `create`   | `--use-npm` · `--use-yarn` · `--use-pnpm` · `--use-bun`         |
| `build`    | `-d, --dev` · `-p, --prod`                                      |
| `start`    | `-b, --build` · `-d, --dev` · `-p, --prod` · `--force-register` |
| `register` | `-b, --build` · `-d, --dev` · `-g, --guild <id>`                |
| `show`     | `-w, --warranty` · `-c, --license`                              |

```bash
npx meocord build --prod          # a production build
npx meocord start --dev           # development, rebuilt and restarted on every change
npx meocord start --build --prod  # a production build, then start
```

- `build` and `start` default to development, and `-p` wins when both `-d` and `-p` are given.
  `start --dev` builds as it starts and on every change, so `--build` matters only with `--prod`.
- `build`, `start` and `register` check `meocord.config.ts` first. One that fails to load stops them with
  the file and line; an option of the wrong type stops them with a list of every problem; an option MeoCord
  does not know is reported as a warning. Every failure exits with code 1.
- `start --force-register` sends the commands to Discord even when they are unchanged, and `register` is
  described in [Registering commands](/docs/4.1/command-registration#registering-without-starting).
- `start` reads one environment variable, `MEOCORD_RUNTIME`, which pins the binary the bot runs on; see
  [Deployment](/docs/4.1/deployment#which-runtime-the-bot-runs-on).

## Generators

| Sub-command   | Alias | Generates                           |
| ------------- | ----- | ----------------------------------- |
| `controller`  | `co`  | a controller, its spec, its builder |
| `service`     | `s`   | a service and its spec              |
| `guard`       | `gu`  | a guard and its spec                |
| `interceptor` | `i`   | an interceptor and its spec         |
| `filter`      | `f`   | an exception filter and its spec    |
| `pipe`        | `pi`  | a pipe and its spec                 |
| `observer`    | `ob`  | a dispatch observer and its spec    |

Generating never overwrites: if any file it would write exists, it refuses, names the files, and writes
nothing. Run generators from the project's root, where its `package.json` is.

## Controllers

```bash
npx meocord g co <type> <name>
```

`<type>` is one of `button`, `modal-submit`, `select-menu`, `user-select-menu`, `role-select-menu`,
`mentionable-select-menu`, `channel-select-menu`, `reaction`, `message`, `slash`, `autocomplete`,
`context-menu` and `primary-entry-point`. Each lands in a folder named after its type:

```text
src/controllers/<type>/
├── <name>.<type>.controller.ts
├── <name>.<type>.controller.spec.ts
└── builders/<name>.builder.ts     # slash, context-menu and primary-entry-point only
```

- A builder is generated only for the three types Discord registers by name. The others are addressed by
  `customId` or, for autocomplete, by the command path it completes.
- Each controller gets its own builder, `<Name>CommandBuilder`, and registers a command named after it:
  `npx meocord g co slash Greeting` registers `/greeting`. An autocomplete controller completes the slash
  command of the same name.
- `<name>` may contain `/` to nest: `npx meocord g co button "admin/ban"` writes into
  `src/controllers/button/admin/`, and a nested slash command uses its whole path, `/admin-ban`, since
  Discord command names are global to the application. `..`, a leading `/` and drive letters are refused;
  on Windows, `\` separates folders too.

Where a controller sits on disk is organisational only: controllers are wired up by the `controllers` list
of `@MeoCord()`.
