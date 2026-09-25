---
id: concepts
title: How MeoCord fits together
section: Core
order: 9
since: 4.1.0
---

A MeoCord bot is a discord.js bot with a container and a router in front of it. This page follows a bot from
build to shutdown, to show where each part of the guides sits.

## Build

`meocord build` compiles the bot and its `meocord.config.ts` into `dist/`. The built bot reads only
`dist/meocord.config.mjs`, so it starts without TypeScript; see [Configuration](/docs/4.1/configuration).

## Start

`dist/main.js` calls `MeoCordFactory.create(App)` on the class `@MeoCord` decorates, then `app.start()`.

1. **Create.** The factory reads `@MeoCord`'s options and the built config, then makes one container. It binds
   the discord.js `Client`, made from `clientOptions`, the translator, the handler registry, the shard
   context, the cooldown store, and every controller and service the app lists, with everything they inject,
   as [singletons](#what-lives-how-long). With [process sharding](/docs/4.1/sharding#a-process-per-shard),
   the first process instead becomes a manager that starts the shards, each of which runs these steps itself.
2. **Log in.** `start()` builds the [component routes](/docs/4.1/component-routing) once, attaches
   MeoCord's listeners to the client, and logs in. A failed login rejects `start()` and sets the exit code
   to 1.
3. **Ready.** When Discord says the client is ready, the controllers and services are resolved and their
   `onReady` hooks run in dependency order; see [Lifecycle hooks](/docs/4.1/lifecycle-hooks). Alongside,
   the commands the builders describe are [registered](/docs/4.1/command-registration).

## Dispatch

Every interaction, message and reaction goes to the handler it belongs to:

| What arrives                                 | Found by                                                   | Handler                            |
| -------------------------------------------- | ---------------------------------------------------------- | ---------------------------------- |
| A slash, context menu or entry point command | its name, and a subcommand's path                          | `@Command(name, Builder)`          |
| An autocomplete request                      | the command's path and the option being typed              | `@Autocomplete`                    |
| A button, select menu or modal               | its `customId`, against every pattern, most specific first | `@Command(pattern, CommandType.…)` |
| A message                                    | its whole text, or any text                                | `@MessageHandler`                  |
| A reaction added or removed                  | its emoji, or any emoji                                    | `@ReactionHandler`                 |
| Any other client event                       | its name                                                   | `@On` and `@Once`                  |

The handler then runs through the [pipeline](/docs/4.1/how-a-handler-runs): `@Defer`'s acknowledgement,
guards, interceptors around validation, pipes, cooldowns and the handler, all inside exception filters.
[`respond()`](/docs/4.1/responses) makes the right call to Discord for where the answer stands.

## What lives how long

| Lives for the whole app                     | Made for each call      |
| ------------------------------------------- | ----------------------- |
| controllers and services                    | guards                  |
| interceptors, exception filters and pipes   | `ExecutionContext`      |
| the `Client`, translator and cooldown store | the handler's arguments |

So a service or a field on a controller holds state across calls, and a guard holds none. A test shows it:
one controller and one service serve two calls, and each call gets its own guard.

::example{file="concepts/lifetimes.ts" region="lifetimes"}

::example{file="concepts/lifetimes.spec.ts" region="spec"}

## Where discord.js begins

MeoCord makes the client, logs it in and routes what it receives. Everything a handler touches is
discord.js's own: the interaction, message, reaction and client are the library's classes, and anything
discord.js can do, a handler or a service that injects the `Client` can do too. See
[Services and injection](/docs/4.1/services#what-you-can-inject).

## Stop

On SIGINT or SIGTERM, the `onShutdown` hooks run in reverse dependency order, within `shutdownTimeout`, and
the client is destroyed. See [Lifecycle hooks](/docs/4.1/lifecycle-hooks#onshutdown).
