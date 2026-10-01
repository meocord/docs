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
formerly: [why-meocord, concepts]
covers: [4.0/features]
---

MeoCord is a framework for Discord bots built on [discord.js](https://discord.js.org). You write a bot as
[controllers](guide:glossary#controller) and [services](guide:glossary#service), and decorators connect them to Discord:
`@Command` binds a method to a slash command, a button or a modal, and the framework routes each interaction to it.

Two parts carry the everyday work. [`respond()`](guide:responses) answers every interaction with the call Discord
expects for where the answer stands, so a [handler](guide:glossary#handler) says what to send and never which method
sends it. And [`meocord/testing`](guide:testing) runs a handler exactly as the bot does, through the same pipeline, with
mocks of discord.js's own classes, so a test passes because the bot works.

Every call a handler receives passes through that pipeline. Guards decide whether it runs, interceptors wrap it,
validation and pipes check and shape its input, cooldowns limit how often it runs, and exception filters decide what the
user is told when it throws. Guards, interceptors and exception filters apply to one method, a whole controller or the
entire bot; cooldowns to a method or a controller; validation to a method.

## When to use it

MeoCord is for bots that grow: many commands and components, rules about who may use them, and code a team wants to
test. It gives a bot the structure a web framework gives a server, and with it:

- **One call that knows where the answer stands.** `respond(interaction)` tracks each answer as unanswered, deferred or
  replied, read from the interaction before every call, and makes the call Discord expects: `reply` or `update` first,
  `editReply` once the answer is deferred or sent, `followUp` for another message. A second `send()` edits rather than
  replying twice, and [`@Defer`](guide:defer) acknowledges a slow handler before Discord's three seconds are up. See
  [Answering with respond()](guide:responses).
- **Tests that run the way the bot runs.** `invoke` and `dispatch` send a call through the same pipeline the bot uses,
  guards, validation, cooldowns and filters included, and `getResponse` reports what `respond()` sent. Mocks of
  discord.js's own classes keep their prototypes and follow Discord's reply rules, and `fromApp` builds the testing
  module from the app class itself. See [Testing](guide:testing), [Mocks](guide:mocks) and
  [Invoke and dispatch](guide:invoke-and-dispatch).
- **One pipeline around every call.** Guards, interceptors, validation, pipes, cooldowns and exception filters run in a
  fixed order around every handler, each set on one method, a controller or the whole bot. See
  [How a call runs](guide:how-a-call-runs).
- **Cooldowns and translations built in.** [`@Cooldown`](guide:cooldowns) counts per user, server, channel or resource,
  in memory or [in Redis](guide:recipes/cooldown-stores), and [typed catalogs](guide:localisation) translate what the
  bot says and the names of its commands.
- **Routes and params the compiler checks.** A button's `counter/{count:int}` gives its handler `count` as a number,
  and a message command's `pay {to:member} {amount:int}` a member and a number. A handler whose params don't fit its
  pattern fails to compile, and so does a catalog with a key the default catalog lacks, or, written inline, `as const`
  or with `defineCatalog`, a `{param}` its default message doesn't take. `expectCompleteCatalog` finds a missing
  message, and such a `{param}` in a plain or JSON catalog too, in a test. See
  [Components](guide:components#typed-params), [Message command params](guide:message-params) and
  [Localisation](guide:localisation#parameters-in-other-languages).
- **Services by constructor.** A controller or a service names what it needs in its constructor, and MeoCord makes
  each one once, in dependency order. See [Services](guide:services).
- **A CLI from create to deploy.** `npx {{meocord}} create` starts a project, `generate` scaffolds a controller, service
  or guard with its spec, `start --dev` rebuilds and restarts on every change, and `build` and `register` ship it. See
  [The CLI](guide:cli).

It covers every interaction Discord sends, from slash commands, subcommands and autocomplete to buttons, the five
select menus, modals, context menus and activity entry points, plus messages, reactions and any gateway event.

## Example

A slash command that greets whoever it names, at most three times in ten seconds per user. The controller handles it,
and a service it asks for in its constructor makes the greeting:

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

The app class lists the controller, with the options discord.js's client is made from:

::example{file="app.ts" region="app"}

[Your first command](guide:first-command) builds this bot step by step.

## How it works

A MeoCord bot is a discord.js bot with a [container](guide:glossary#container) and a router in front of it. Here is a
bot from build to shutdown, and where each part of this guide sits.

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
   [Lifecycle hooks](guide:lifecycle-hooks). Alongside, the commands the [builders](guide:glossary#builder) describe
   are registered; see [Slash commands](guide:slash-commands).

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

The handler then runs through the [pipeline](guide:how-a-call-runs): `@Defer`'s
[acknowledgement](guide:glossary#acknowledgement), guards, interceptors around validation, pipes, cooldowns and the
handler, all inside exception filters. [Observers](guide:observers) are told about the call as it starts and once it has
settled. [`respond()`](guide:responses) makes the right call to Discord for where the answer stands.

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

If you've built a bot before, most of what you know carries over. Each framework below is a good home for the bots
built on it, and each "coming from" page shows one bot both ways. The comparison is as of 25 September 2026, against the
versions named, from each project's own documentation and published packages; corrections are welcome in the
[issue tracker](https://github.com/meocord/meocord/issues).

**From discord.js alone** (14.27.0). Every framework here, MeoCord included, is built on it, and a MeoCord handler
receives discord.js's own interaction, message and client. What you stop writing is the plumbing around them: the
command handler, component routing, error handling and answer tracking. See
[Coming from discord.js](guide:coming-from/discordjs).

**From Sapphire** (`@sapphire/framework` 5.5.1), the most downloaded of these frameworks on npm. Its commands,
listeners and preconditions become controllers, `@On` handlers and guards, and the global `container` becomes
constructor injection. Translations and subcommands, plugins in Sapphire, are built into MeoCord, and scheduled work is
a service, as [Scheduled tasks](guide:recipes/scheduled) shows. See [Coming from Sapphire](guide:coming-from/sapphire).

**From Necord** (7.0.0), a NestJS module. Nest's guards, interceptors, pipes and exception filters have MeoCord
counterparts with the same names and roles, built for Discord alone, so the bot needs no Nest application around it.
`@TextCommand` becomes a typed message pattern, and `@necord/localization` typed catalogs. See
[Coming from Necord](guide:coming-from/necord).

**From discordx** (11.13.3). Decorators on classes, as in MeoCord. Guard functions become guard classes that inject
services, TSyringe or TypeDI become the built-in injection, and `@SimpleCommand` a typed pattern. Where discordx runs
several bots in one process, a MeoCord bot is its own process, with its own config, token and logs. See
[Coming from discordx](guide:coming-from/discordx).

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

## Good to know

- **A modern core.** MeoCord runs on discord.js 14, with Node.js 22.13+ or Bun. What a plugin would add elsewhere is a
  plain [service](guide:services) here: injected where it's needed, and tested like the rest of the bot.
- **Built for TypeScript.** The compiler checks each handler's params against its route or pattern, and each catalog's
  keys against the default one's, and `npx {{meocord}} create` starts every project in TypeScript.
- **One process, one bot.** A process logs in with the token its `meocord.config.ts` gives, so each bot keeps its own
  config, token and logs, and restarts on its own. One bot grows across processes, a shard in each; see
  [Sharding](guide:sharding).

## Next steps

- [Getting started](guide:getting-started): create a bot and start it.
- [Your first command](guide:first-command): write a slash command, its service and its test.
- Upgrading from 4.0: the [migration guide](guide:migrating) lists what to check.
