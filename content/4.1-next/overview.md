---
id: overview
title: Overview
chapter: start
order: 1
summary: What MeoCord is, what a bot built with it is made of, and how its parts run from build to shutdown.
learn:
  - Tell what MeoCord adds to discord.js, and when it fits
  - Name the parts of a MeoCord bot and what each one does
  - Follow a bot from build to shutdown
requires: []
api: [decorators/MeoCord, decorators/Controller, decorators/Command, responses/respond]
formerly: [features, why-meocord, concepts]
---

MeoCord is a framework for Discord bots built on [discord.js](https://discord.js.org). You write a bot as controllers
and services, and decorators connect them to Discord: `@Command` binds a method to a slash command, a button or a
modal, and the framework routes each interaction to it.

Every call a handler receives passes through the same pipeline. Guards decide whether it runs, interceptors wrap it,
validation and pipes check and shape its input, cooldowns limit how often it runs, and exception filters decide what the
user is told when it throws. Guards, interceptors and exception filters apply to one method, a whole controller or the
entire bot; cooldowns to a method or a controller; validation to a method.

## When to use it

MeoCord is for bots that grow: many commands and components, rules about who may use them, and code a team wants to
test. It gives a bot the structure a web framework gives a server.

- **Decorators and injection.** A controller declares what it handles, and its services arrive through its
  constructor. Listing the controller in `@MeoCord` is all it takes: nothing is wired to discord.js by hand.
- **One pipeline for every call.** Guards, interceptors, validation, pipes, cooldowns and exception filters run in a
  fixed order around every handler, and `@Defer` and `respond()` take care of Discord's answer rules. See
  [How a call runs](guide:how-a-call-runs).
- **Tested the way it runs.** `invoke` runs a handler through the same pipeline the bot does, with mocks of
  discord.js's own classes. See [Testing](guide:testing).

It covers every interaction Discord sends, from slash commands, subcommands and autocomplete to buttons, the five
select menus, modals, context menus and activity entry points, plus messages, reactions and any gateway event. A CLI
creates the project, scaffolds its parts, builds it and runs it.

## Example

A slash command that greets whoever it names, at most three times in ten seconds per user. The controller handles it,
and a service it asks for in its constructor makes the greeting:

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

The app class lists the controller, with the options discord.js's client is made from:

::example{file="app.ts" region="app"}

[Your first command](guide:first-command) builds this bot step by step.

## How it works

A MeoCord bot is a discord.js bot with a container and a router in front of it. Here is a bot from build to shutdown,
and where each part of this guide sits.

### Build

`meocord build` compiles the bot and its `meocord.config.ts` into `dist/`. The built bot reads only
`dist/meocord.config.mjs`, so it starts without TypeScript; see [Configuration](guide:configuration).

### Start

`dist/main.js` calls `MeoCordFactory.create(App)` on the class `@MeoCord` decorates, then `app.start()`.

1. **Create.** The factory reads `@MeoCord`'s options and the built config, then makes one container. It binds the
   discord.js `Client`, made from `clientOptions`, the translator, the handler registry, the shard context, the cooldown
   store, and every controller and service the app lists, with everything they inject, as
   [singletons](#what-lives-how-long). With [process sharding](guide:sharding), the first process instead becomes a
   manager that starts the shards, each of which runs these steps itself.
2. **Log in.** `start()` first makes every provided value, waiting for async factories, and the services `@MeoCord`
   lists, so their constructors run before login. It then builds the component routes once, attaches MeoCord's
   listeners to the client, and logs in. A failed factory or login rejects `start()` and sets the exit code to 1.
3. **Ready.** When Discord says the client is ready, whatever isn't made yet, such as the controllers and the services
   only injected, is resolved, and the `onReady` hooks run in dependency order; see
   [Lifecycle hooks](guide:lifecycle-hooks). Alongside, the commands the builders describe are registered; see
   [Slash commands](guide:slash-commands).

### Dispatch

Every interaction, message and reaction goes to the handler it belongs to:

| What arrives                                 | Found by                                                   | Handler                            |
| -------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| A slash, context menu or entry point command | its name, and a subcommand's path                          | `@Command(name, Builder)`          |
| An autocomplete request                      | the command's path and the option being typed              | `@Autocomplete`                    |
| A button, select menu or modal               | its `customId`, against every pattern, most specific first | `@Command(pattern, CommandType.…)` |
| A message                                    | its words after the prefix, or any text                    | `@MessageHandler`                  |
| A reaction added or removed                  | its emoji, or any emoji                                    | `@ReactionHandler`                 |
| Any other client event                       | its name                                                   | `@On` and `@Once`                  |

The handler then runs through the [pipeline](guide:how-a-call-runs): `@Defer`'s acknowledgement, guards, interceptors
around validation, pipes, cooldowns and the handler, all inside exception filters. [Observers](guide:observers) are told
about the call as it starts and once it has settled. [`respond()`](guide:responses) makes the right call to Discord for
where the answer stands.

### What lives how long

| Lives for the whole app                              | Made for each call      |
| ---------------------------------------------------- | ----------------------- |
| controllers and services                             | guards                  |
| interceptors, exception filters, pipes and observers | `ExecutionContext`      |
| the `Client`, translator and cooldown store          | the handler's arguments |

So a service or a field on a controller holds state across calls, and a guard holds none. A test shows it: one
controller and one service serve two calls, and each call gets its own guard.

::example{file="concepts/lifetimes.ts" region="lifetimes"}

::example{file="concepts/lifetimes.spec.ts" region="spec"}

### Where discord.js begins

MeoCord makes the client, logs it in and routes what it receives. Everything a handler touches is discord.js's own: the
interaction, message, reaction and client are the library's classes, and anything discord.js can do, a handler or a
service that injects the `Client` can do too. See [Services](guide:services).

### Stop

On SIGINT or SIGTERM, the `onShutdown` hooks run in reverse dependency order, within `shutdownTimeout`, and the client
is destroyed. See [Lifecycle hooks](guide:lifecycle-hooks).

## Other ways to build a bot

Each of these is a good choice for some bots. The comparison is as of 25 September 2026, against the versions named,
from each project's own documentation and published packages; corrections are welcome in the
[issue tracker](https://github.com/meocord/meocord/issues).

**discord.js alone** (14.27.0). Every framework here, MeoCord included, is built on it. Alone, it has no framework to
learn and nothing between you and the API; the command handler, component routing and error handling are yours to
write. Pick it for a small bot, or to learn how Discord works.

**Sapphire** (`@sapphire/framework` 5.5.1). The most downloaded of these frameworks on npm. Commands, listeners and
preconditions are pieces, loaded from their folders; shared objects are properties of a global `container`. Official
plugins add i18next translation, subcommands, scheduled tasks, an HTTP API and hot reloading, and it supports JavaScript
as well as TypeScript. Pick it for its ecosystem and plugins, for prefix commands with argument parsing, or to write
JavaScript.

**Necord** (7.0.0). A NestJS module: the bot lives inside a NestJS application and uses Nest's own modules, guards,
interceptors, pipes and exception filters, with text commands through `@TextCommand` and translations through
`@necord/localization`. Pick it if you already run NestJS, and want the bot to share its modules, configuration and HTTP
API.

**discordx** (11.13.3). Decorators on classes, with guards written as middleware functions, dependency injection
through TSyringe or TypeDI, prefix commands with `@SimpleCommand`, and several bots in one process. Its packages add
pagination, and music playback with Lavalink. Pick it for prefix commands, several bots in one process, or its music
packages.

## At a glance

"None in its docs" means the project's documentation, as of the date above, names no such feature; a community package
may add one.

|                      | MeoCord                                 | Sapphire                     | Necord                                  | discordx                                   |
| -------------------- | --------------------------------------- | ---------------------------- | --------------------------------------- | ------------------------------------------ |
| Declaring handlers   | decorators                              | pieces, loaded from folders  | decorators                              | decorators                                 |
| Dependency injection | constructor injection, built in         | a global `container`         | NestJS's                                | TSyringe or TypeDI                         |
| Before a handler     | guards, interceptors, validation, pipes | preconditions                | NestJS's guards, interceptors and pipes | guard functions                            |
| Around errors        | exception filters                       | error events, with listeners | NestJS's exception filters              | none in its docs                           |
| Cooldowns            | `@Cooldown`                             | `cooldownDelay`, built in    | none in its docs                        | a `RateLimit` guard, `@discordx/utilities` |
| Prefix commands      | typed patterns, flags and prefixes      | yes, with argument parsing   | `@TextCommand`, with arguments          | `@SimpleCommand`, with options             |
| Testing toolkit      | `meocord/testing`: `invoke`, mocks      | none in its docs             | NestJS's testing module                 | none in its docs                           |
| Translations         | typed catalogs, built in                | `@sapphire/plugin-i18next`   | `@necord/localization`                  | none in its docs                           |
| Language             | TypeScript                              | TypeScript or JavaScript     | TypeScript                              | TypeScript                                 |
| Documented runtime   | Node.js 22.13+ or Bun                   | Node.js 18+                  | Node.js 20.19+ or 22.13+                | Node.js 20+                                |
| Needs                | nothing else                            | nothing else                 | a NestJS application                    | nothing else                               |

## Gotchas

- **It is young,** with a small community and no plugin ecosystem; what a plugin would add, you write as a service.
- **It is TypeScript only.**
- **A process runs one bot:** it logs in with the one token its `meocord.config.ts` gives, so two bots take a process
  each. One bot can span processes, a shard in each; see [Sharding](guide:sharding).

## Next steps

- [Getting started](guide:getting-started): create a bot and start it.
- [Your first command](guide:first-command): write a slash command, its service and its test.
- Upgrading from 4.0: the [migration guide](guide:migrating) lists what to check.
