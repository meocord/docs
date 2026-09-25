---
id: gateway-events
title: Gateway events
section: Beyond commands
order: 51
since: 4.1.0
---

`@On(event)` handles a discord.js client event every time it is emitted, and `@Once(event)` the first time
only. The handler's parameters are typed from discord.js's `ClientEvents`:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

- **Where**: on any controller or service the app binds, listed in `@MeoCord({ controllers, services })` or
  injected by one. The instance is resolved when the first event arrives.
- **Guards and interceptors** apply as they do to a command: `@UseGuard` and `@UseInterceptor` on the method
  or the class, and the app's global ones. A guard receives the event's arguments, and
  `ExecutionContext.getType()` is `'event'`. A global guard written for interactions declares
  `@Guard({ types: ['interaction'] })` so it skips events; at startup, MeoCord names each global guard or
  interceptor without `types` that will also run on events.
- **Errors** go to the handler's [exception filters](/docs/4.1/exception-filters). One no filter handles is
  logged with the event and the handler's name. It is never answered, and it stops neither the bot nor the
  other handlers of that event.
- **Intents**: at startup, MeoCord warns once for each intent or partial a handler needs that `clientOptions`
  lacks, such as `GuildMembers` for `guildMemberAdd`. A privileged intent is also enabled in the Discord
  developer portal, under Bot, then Privileged Gateway Intents; if Discord refuses one at login, the bot says
  which, and `app.start()` rejects with an error `isExplainedError(error)` from `meocord/common` recognises,
  so the generated `main.ts` does not log it a second time.
- `@On('interactionCreate')` and `@On('messageCreate')` run alongside MeoCord's own dispatch of those events.
- **Names**: `@Once` tells classes apart by name, so the bot refuses to start when two classes share a name
  and either has a `@Once` handler.

For work that starts once the bot is online and stops with it, [lifecycle hooks](/docs/4.1/lifecycle-hooks)
fit better than `@Once('clientReady')`: they run in dependency order, and have a matching shutdown hook.

## Testing

`module.emit(event, ...args)` sends an event to the module's handlers through the same pipeline, and
resolves to how many ran:

::example{file="controllers/event/welcome.controller.spec.ts" region="spec"}

`emit` rejects once every handler has settled if any threw: with that error, or an `AggregateError` when
several did.
