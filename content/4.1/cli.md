---
id: cli
title: The CLI
chapter: shipping
order: 1
summary: Create a project, run it while you work, build and register it for production, and scaffold its parts.
learn:
  - Run the bot in development, and build and start it for production
  - Register its commands without starting it
  - Scaffold controllers, services and the rest from the command line
requires: [getting-started, slash-commands]
api: [cli/create, cli/start, cli/build, cli/register, cli/generate]
since: 4.0.0
covers: [4.0/cli-reference, 4.1/cli-reference]
---

`meocord` is the command a MeoCord project runs through. It creates the project, runs the bot while you work,
builds it for production, registers its commands with Discord, and writes the files for a new controller or
service. This page shows how the commands fit together; the [CLI reference](api:cli/start) lists every flag.

## When to use it

- **While you work:** `start --dev` rebuilds and restarts the bot on every change.
- **On the server:** `build --prod`, then `start --prod`, or run the build with `node dist/main.js`, as
  [Deployment](guide:deployment) does in a container.
- **When registering is its own step:** `register` sends the commands to Discord without starting the bot, from CI
  for instance.
- **For a new part:** `generate` writes a controller, service, guard, interceptor, filter, pipe or observer, with a
  spec beside it.

## Example

```bash
npx meocord start --dev          # build, start, and rebuild and restart on every change
npx meocord g co slash Greeting  # a /greeting command: its controller, spec and builder
npx meocord build --prod         # a production build in dist/
npx meocord start --prod         # start that build
```

Inside a project, `npx meocord` runs the version the project installed. Keep `start --dev` running while you work,
and add a part with `generate` beside it: the new files rebuild the bot like any other change.

## How it works

`build`, `start` and `register` read `meocord.config.ts` first:

- a file that fails to load stops them with its file and line;
- an option of the wrong type stops them with a list of every problem;
- an option MeoCord doesn't know is reported as a warning.

`start` and `register` then check for the token, and stop at once when `discordToken` is empty. Every failure exits
with code 1, so a script or a CI job stops too.

`build` and `start` build for development unless they're given `-p, --prod`, which wins when both `-d` and `-p` are
given. `register` works the other way round: it registers as production does, unless it's given `-d, --dev`.

The bot runs on the runtime you launched the CLI with: `bun run start:prod` runs it under Bun, and `npm run start:prod`
under Node. [Which runtime the bot runs on](guide:deployment#which-runtime-the-bot-runs-on) covers pinning one.

## Creating a project

```bash
npx {{meocord}} create my-bot
```

`create` writes a project into a new folder named after the app, in kebab case, and installs it. It asks which
package manager to use; `--use-npm`, `--use-yarn`, `--use-pnpm` or `--use-bun` answers for it, and fails when that
package manager isn't installed. It's the one command run outside a project, so the command above names the version
this guide documents. [Getting started](guide:getting-started) walks through it.

## Development and production

`start --dev` builds the bot as it starts, then watches the project: a change rebuilds it and restarts the bot, and
`meocord.config.ts` is watched too. It registers the commands to `commands.developmentGuild`, or globally without one,
and only when they changed since the last development start; `--force-register` sends them anyway.

For production, build once and start the build:

```bash
npx meocord build --prod
npx meocord start --prod
```

`start --prod` runs the build in `dist/` as it is, so start it after every build. `start --build --prod` does both in
one command. `--build` matters only with `--prod`, since `start --dev` always builds.

## Registering commands

A production start registers every command as the bot logs in, and Discord applies an unchanged set without harm.
`register` does the same without starting the bot:

```bash
npx meocord register --build           # build, then register every command
npx meocord register --guild 123456789  # every command, to this server only
npx meocord register --dev             # to commands.developmentGuild, as development does
```

Set `commands.register` to `false` to keep registering out of startup, and run `register` once per deploy instead.
[Registering commands](guide:slash-commands#registering-commands) covers the scopes.

## Scaffolding

`generate`, or `g`, writes a part and its spec:

| Subcommand    | Alias | Writes                              |
| ------------- | ----- | ----------------------------------- |
| `controller`  | `co`  | a controller, its spec, its builder |
| `service`     | `s`   | a service and its spec              |
| `guard`       | `gu`  | a guard and its spec                |
| `interceptor` | `i`   | an interceptor and its spec         |
| `filter`      | `f`   | an exception filter and its spec    |
| `pipe`        | `pi`  | a pipe and its spec                 |
| `observer`    | `ob`  | a dispatch observer and its spec    |

It prints where to wire the part up: a controller goes in `@MeoCord({ controllers })`, and a service is bound the
first time something injects it.

### Controllers

```bash
npx meocord g co <type> <name>
```

`<type>` is one of `button`, `modal-submit`, `select-menu`, `user-select-menu`, `role-select-menu`,
`mentionable-select-menu`, `channel-select-menu`, `reaction`, `message`, `slash`, `autocomplete`, `context-menu` and
`primary-entry-point`. Each lands in a folder named after its type:

```text
src/controllers/<type>/
├── <name>.<type>.controller.ts
├── <name>.<type>.controller.spec.ts
└── builders/<name>.builder.ts     # slash, context-menu and primary-entry-point only
```

- **A builder** comes only with the three types Discord registers by name. `npx meocord g co slash Greeting` registers
  `/greeting`. The other types are reached by custom ID, or, for autocomplete, by the command they complete.
- **A message context menu** is `npx meocord g co context-menu Report --message`; without `--message`, it's a user
  context menu.
- **A name with `/`** nests the files: `npx meocord g co slash admin/ban` writes into `src/controllers/slash/admin/`
  and registers `/admin-ban`, since a command's name is global to the application.

Where a controller sits is only a convention: `@MeoCord({ controllers })` is what wires it up.

## Gotchas

- **`generate` never overwrites.** When a file it would write exists, it names the files and writes nothing.
- **`generate` runs from the project's root,** beside `package.json`; anywhere else, it refuses rather than scatter
  files. A name can't leave its folder: `..`, a leading `/` and a drive letter are refused.
- **`start --prod` runs the last build.** After changing code, build again, or use `start --build --prod`.
- **`--message` is for context menus only.** On any other type, `generate` refuses it.

## Next steps

- [Self-contained builds](guide:self-contained-builds): ship `dist/` with no `node_modules` beside it.
- [Deployment](guide:deployment): run the build on a server, in Docker or under systemd, and stop it cleanly.
- [The CLI reference](api:cli/generate): every command, argument and flag, with an example of each.
