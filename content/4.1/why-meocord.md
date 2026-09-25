---
id: why-meocord
title: Why MeoCord
section: Start
order: 0
since: 4.1.0
---

MeoCord is for bots that grow: many commands and components, rules about who may use them, and code a team
wants to test. It gives a bot the structure a web framework gives a server.

- **Decorators and injection.** A controller declares what it handles, and its services arrive through its
  constructor. Nothing is registered by hand.
- **One pipeline for every call.** Guards, interceptors, validation, pipes, cooldowns and exception filters
  run in a fixed order around every handler, and `@Defer` and `respond()` take care of Discord's answer
  rules. See [How a call runs](/docs/4.1/how-a-handler-runs).
- **Tested the way it runs.** `invoke` runs a handler through the same pipeline the bot does, with mocks of
  discord.js's own classes. See [Testing](/docs/4.1/testing).

## Other ways to build a bot

Each of these is a good choice for some bots. The comparison is as of 25 September 2026, against the
versions named, from each project's own documentation and published packages; corrections are welcome in the
[issue tracker](https://github.com/meocord/meocord/issues).

**discord.js alone** (14.27.0). Every framework here, MeoCord included, is built on it. Alone, it has no
framework to learn and nothing between you and the API; the command handler, component routing and error
handling are yours to write. Pick it for a small bot, or to learn how Discord works.

**Sapphire** (`@sapphire/framework` 5.5.1). The most downloaded of these frameworks on npm. Commands, listeners
and preconditions are pieces, loaded from their folders; shared objects are properties of a global
`container`. Official plugins add i18next translation, subcommands, scheduled tasks, an HTTP API and hot
reloading, and it supports JavaScript as well as TypeScript. Pick it for its ecosystem and plugins, for prefix
commands with argument parsing, or to write JavaScript.

**Necord** (7.0.0). A NestJS module: the bot lives inside a NestJS application and uses Nest's own modules,
guards, interceptors, pipes and exception filters, with text commands through `@TextCommand` and translations through
`@necord/localization`. Pick it if you already run NestJS, and want the bot to share its
modules, configuration and HTTP API.

**discordx** (11.13.3). Decorators on classes, with guards written as middleware functions, dependency
injection through TSyringe or TypeDI, prefix commands with `@SimpleCommand`, and several bots in one process.
Its packages add pagination, and music playback with Lavalink. Pick it for prefix commands, several bots in
one process, or its music packages.

## At a glance

"None in its docs" means the project's documentation, as of the date above, names no such feature; a
community package may add one.

|                      | MeoCord                                 | Sapphire                     | Necord                                  | discordx                                   |
| -------------------- | --------------------------------------- | ---------------------------- | --------------------------------------- | ------------------------------------------ |
| Declaring handlers   | decorators                              | pieces, loaded from folders  | decorators                              | decorators                                 |
| Dependency injection | constructor injection, built in         | a global `container`         | NestJS's                                | TSyringe or TypeDI                         |
| Before a handler     | guards, interceptors, validation, pipes | preconditions                | NestJS's guards, interceptors and pipes | guard functions                            |
| Around errors        | exception filters                       | error events, with listeners | NestJS's exception filters              | none in its docs                           |
| Cooldowns            | `@Cooldown`                             | `cooldownDelay`, built in    | none in its docs                        | a `RateLimit` guard, `@discordx/utilities` |
| Prefix commands      | exact-keyword message handlers only     | yes, with argument parsing   | `@TextCommand`, with arguments          | `@SimpleCommand`, with options             |
| Testing toolkit      | `meocord/testing`: `invoke`, mocks      | none in its docs             | NestJS's testing module                 | none in its docs                           |
| Translations         | typed catalogs, built in                | `@sapphire/plugin-i18next`   | `@necord/localization`                  | none in its docs                           |
| Language             | TypeScript                              | TypeScript or JavaScript     | TypeScript                              | TypeScript                                 |
| Documented runtime   | Node.js 22.13+ or Bun                   | Node.js 18+                  | Node.js 20.19+ or 22.13+                | Node.js 20+                                |
| Needs                | nothing else                            | nothing else                 | a NestJS application                    | nothing else                               |

## Where MeoCord is weaker

- It is young, with a small community and no plugin ecosystem; what a plugin would add, you write as a
  service.
- It is TypeScript only.
- Message commands take params by pattern, as strings to validate, but have no typed options, generated
  help or subcommand groups of their own.
- A process runs one bot: two bots, each with its own token, take a process each. One bot can span processes,
  a shard in each; see [Sharding](/docs/4.1/sharding).

## Try it

[Getting started](/docs/4.1/getting-started) creates a bot in a minute, and
[A first command](/docs/4.1/quick-start) walks through its parts.
