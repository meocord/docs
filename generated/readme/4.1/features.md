---
id: features
title: 'Features'
order: 2
source: readme@4.1.0-beta.0
---

- **Decorator-based controllers** — Handle every Discord interaction type — slash commands and their subcommands, autocomplete, buttons, modals, all five select menus, context menus, activity entry points, messages, and reactions — with `@Command`, `@Autocomplete`, `@MessageHandler` and `@ReactionHandler`. No routing boilerplate.
- **Dependency injection** — Built on Inversify. Services are wired into controllers automatically; no manual instantiation or service locators.
- **A request pipeline** — [Guards](/docs/4.1/guards#guards) decide whether a handler runs, [interceptors](/docs/4.1/interceptors#interceptors) wrap it, [validation and pipes](/docs/4.1/validation-and-pipes#validation-and-pipes) check and transform its input, [cooldowns](/docs/4.1/cooldowns#cooldowns) limit how often it runs, and [exception filters](/docs/4.1/exception-filters#exception-filters) decide what the user is told when something throws. Each applies to a method, a controller, or the whole bot.
- **Interaction responses** — `respond(interaction)` answers every interaction type correctly from any state, deferred or replied, wherever a user-installed app is used; a presenter styles MeoCord's own answers.
- **Cooldowns** — `@Cooldown` limits how often a handler runs, per user, server, channel or for everyone, with a pluggable store to share the count across shards.
- **Gateway events** — `@On` and `@Once` handle any discord.js client event on a controller or service, with typed arguments and the same pipeline. `HandlerRegistry` lists every handler for a `/help` command or generated docs.
- **Lifecycle hooks** — `onReady` and `onShutdown` on any controller or service, in dependency order, for schedulers, cache warm-up and clean shutdown.
- **Localisation** — One typed catalog per locale for command names, descriptions and replies, checked at compile time.
- **Command registration and sharding** — Register globally, to guilds or to a development guild, from startup or CI; shard in one process or across processes with one setting.
- **Full CLI** — `meocord create`, `build`, `start`, `register` and `generate`, which scaffolds controllers, services, guards, interceptors, filters and pipes, each with a spec. Builds with Rsbuild for development and production.
- **Testing utilities** — `MeoCordTestingModule` runs a handler through its whole pipeline with `invoke` and sends events with `emit`; `inspectHandler`, `createMockInteraction`, `createMock` and the other mocks test controllers without a Discord connection. Type guards and reply state machines work out of the box.
- **TypeScript-first** — Strict types throughout: handler parameters checked against validation schemas and event types, typed metadata and catalogs, and typed config.
- **Extensible build** — An Rsbuild hook in `meocord.config.ts` to adjust the build without ejecting, and a self-contained build that runs without `node_modules`.

---
