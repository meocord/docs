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
and add a part with `generate` beside it: the bot rebuilds and restarts once something imports the new files, as
adding a controller to `src/app.ts` does.

## How it works

`build`, `start --dev` and any command given `--build` read `meocord.config.ts` first; `start --prod` and `register`
read the config the last build compiled into `dist/`, and `meocord.config.ts` only when there is none:

- a file that fails to load stops them with its file and line;
- an option of the wrong type stops them with a list of every problem;
- an option MeoCord doesn't know is reported as a warning.

`start` and `register` then check for the token, and stop at once when `discordToken` is empty. Every failure exits
with code 1, so a script or a CI job stops too.

`build` and `start` build for development unless they're given `-p, --prod`, which wins when both `-d` and `-p` are
given. `register` works the other way round: it registers as production does, unless it's given `-d, --dev`.

The bot runs on the runtime you launched the CLI with. In an app created with npm, yarn or pnpm, `bun run start:prod`
runs it under Bun and `npm run start:prod` under Node; an app created with bun has `bun --bun` in its scripts, so they
run it under Bun however they're started. [Which runtime the bot runs
on](guide:deployment#which-runtime-the-bot-runs-on) covers pinning one.

## Creating a project

```bash
npx {{meocord}} create my-bot
```

`create` writes a project into a new folder named after the app, in kebab case, and installs it. It asks which
package manager to use; `--use-npm`, `--use-yarn`, `--use-pnpm` or `--use-bun` answers for it, and fails when that
package manager isn't installed. It's the one command run outside a project, so the command above names the version
this guide documents. [Getting started](guide:getting-started) walks through it.

After the install, `create` makes the folder a git repository and commits it, lockfile included. When git can't make
that commit, on a machine with no `user.email` for instance, or with no git at all, the project stays as it is, and
`create` prints the commands that finish the commit. Inside an existing repository, it makes no new one and leaves the
files to that repository.

## Development and production

`start --dev` builds the bot as it starts, then watches the project: a change rebuilds it and restarts the bot, and
`meocord.config.ts` and `tsconfig.json` are watched too. A change to `.env`, `.env.local`, `.env.development` or
`.env.development.local` restarts the bot without a rebuild, since the bot reads them as it starts, as development
whatever `NODE_ENV` the shell holds. It registers the commands to `commands.developmentGuild`, or where production would
without one, and only when they changed since the last development start; `--force-register` sends them anyway.

A restart stops the running bot as Ctrl+C does, so its [`onShutdown` hooks](guide:lifecycle-hooks#onshutdown) run
before the new one starts, on every platform, Windows included. One save makes one restart, even when it makes two
builds of the same output.

A bot that can't log in, or exits on its own, leaves watch mode running: the next change starts it again. So does a
rebuild that can't start, as when a saved `meocord.config.ts` has an `rsbuild` hook that throws: the bot keeps running
its last build, watch mode says why, and saving again retries. When watch mode itself can't start, `start --dev` stops
the bot it started and exits with code 1, as `build` does. In a terminal, it clears the screen as it starts and keeps
your scrollback; `build` and `start --prod` never clear it, and write no escape codes into piped output such as a CI
log or `docker logs`.

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

Once the files are written, `generate` formats them with the project's own ESLint, in one run, and says
"Formatting with your project's ESLint..." while it waits. When it can't run, or reports problems it can't fix,
`generate` says "Could not format the generated files:" and why, and still exits 0. Either way, the files are kept, with
whatever ESLint fixed. A project without ESLint skips the step.

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
  `/greeting`. The builder receives that name from `@Command`, so the two can't drift apart. The other types are
  reached by custom ID, or, for autocomplete, by the command they complete.
- **The spec** invokes the handler through the [testing module](guide:testing), with the input Discord would send it,
  and checks its answer: a command's reply, a button's update, the choices an autocomplete offers.
- **An autocomplete controller** completes the `query` option of the command it's named after, which already exists
  with its own builder. `generate` leaves that builder alone and prints the option to add to it, with
  `setAutocomplete(true)`; until the command declares it, Discord never asks the handler.
- **A message context menu** is `npx meocord g co context-menu Report --message`; without `--message`, it's a user
  context menu.
- **A name with `/`** nests the files: `npx meocord g co slash admin/ban` writes into `src/controllers/slash/admin/`
  and registers `/admin-ban`, since a command's name is global to the application.

Where a controller sits is only a convention: `@MeoCord({ controllers })` is what wires it up.

## Gotchas

- **`generate` never overwrites.** When a file it would write exists, it names the files and writes nothing.
- **`generate` runs from the project's root,** beside `package.json`; in a folder without a `package.json`, it refuses
  rather than scatter files. A name can't leave its folder: `..`, a leading `/` and a drive letter are refused.
- **`start --prod` runs the last build.** After changing code, build again, or use `start --build --prod`.
- **`--message` is for context menus only.** On any other type, `generate` refuses it.

## Next steps

- [Self-contained builds](guide:self-contained-builds): ship `dist/` with no `node_modules` beside it.
- [Deployment](guide:deployment): run the build on a server, in Docker or under systemd, and stop it cleanly.
- [The CLI reference](api:cli/generate): every command, argument and flag, with an example of each.
