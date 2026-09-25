---
id: command-registration
title: Registering commands
section: Core
order: 11
since: 4.1.0
---

Discord shows a command only once the bot has registered it. MeoCord registers the slash, context menu and
entry point commands your builders describe when the bot is ready, globally by default, on every start.
`commands` in `meocord.config.ts` changes where, and whether at startup:

::example{file="config/commands.meocord.config.ts" region="config"}

| Option             | Default | What it does                                                                                                                                    |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `guilds`           | none    | Registers every command to these servers instead of globally. Unset or empty means global.                                                      |
| `developmentGuild` | none    | While `NODE_ENV` is `development`, as under `start --dev`, every command goes to this server and nowhere else. Server commands show up at once. |
| `register`         | `true`  | Registers at startup. Set it to `false` to register only with `meocord register`, from CI for instance.                                         |
| `clearOther`       | `false` | Removes this application's commands from the scopes named here but not in use. Without it, such leftovers are reported as a warning.            |

Each scope gets one bulk update, which replaces everything the application has there, so a command you
remove disappears on the next registration. A failed registration is logged, and the bot stays online.

## A command in its own servers

A builder's `guilds` option sends its command to those servers only, instead of the scope above: for staff
commands, say. The ids are read when the class is decorated, after `.env` has loaded:

::example{file="controllers/slash/builders/ban.builder.ts" region="builder"}

A builder whose list is empty, once blank ids are dropped, is registered nowhere rather than published
globally by accident. Under a development server it goes there with the rest.

## Leftover commands

Moving from global to server commands, or back, leaves the old ones behind, and Discord shows both. After
registering, MeoCord checks the scopes the configuration names that it did not send to: global, `guilds`,
`developmentGuild` and builders' servers. It warns about commands left there, and `clearOther: true` removes
them instead.

While `developmentGuild` receives every command, leftovers are only warned about, even with `clearOther`:
development and production often share one application, and the global commands belong to production.
Production starts, and `meocord register` without `--dev`, do remove them.

## Unchanged commands in development

Under `start --dev`, a scope whose commands have not changed since the last start from this project is not
sent again; the record is kept in `node_modules/.cache/meocord`. `meocord start --dev --force-register` sends
them anyway, after you deleted commands in the Developer Portal, for instance. Production always sends, and
the update is idempotent.

## Registering without starting

`meocord register` registers and exits without connecting to the gateway. It runs the built bot in a mode
that reads the commands and constructs no controller or service, so it needs a build, which `--build` makes,
and the same token as the bot:

```bash
npx meocord register --build          # the production scope
npx meocord register --dev            # to commands.developmentGuild
npx meocord register --guild 1234567  # every command to one server
```

It exits with a non-zero code when Discord rejects the token or the commands, so a deploy step can stop
on it.
