---
id: gateway-events
title: Gateway events
chapter: messages
order: 4
summary: Handle any discord.js client event, such as a member joining, with `@On` and `@Once`.
learn:
  - Handle a client event every time, or once
  - Run guards and filters on an event
  - Find the intent an event needs, and test the handler
requires: [first-command]
api: [decorators/On, decorators/Once]
since: 4.1.0
---

`@On('guildMemberAdd')` runs a method every time discord.js emits that event, and `@Once` the first time only.
The handler's parameters are typed from discord.js's `ClientEvents`, so `guildMemberAdd` gives a `GuildMember`.

## When to use it

Use an event handler for what happens in Discord without a command: a member joins, the bot is added to a
server, a message is edited or deleted, a role changes.

For commands and components, use their decorators instead: `@Command`, `@MessageHandler` and
`@ReactionHandler` route by name, pattern or emoji. For work when the bot starts and stops, use
[lifecycle hooks](guide:lifecycle-hooks) rather than `@Once('clientReady')`.

## Example

::playground{file="controllers/event/welcome.controller.ts" region="controller" dispatch="event guildMemberAdd"}

## How it works

- **Where.** On any controller or service the app binds: listed in `@MeoCord({ controllers, services })`,
  or injected by one. The instance is created when the first event arrives. `@Command`, `@MessageHandler`,
  `@ReactionHandler` and `@Autocomplete` run only on a controller in `controllers`.
- **Pipeline.** An event runs through the same [pipeline](guide:how-a-call-runs) as a command. Guards and
  interceptors on the method or class apply, and the app's global ones. A guard receives the event's
  arguments, and `ExecutionContext.getType()` is `'event'`.
- **Alongside dispatch.** `@On('interactionCreate')` and `@On('messageCreate')` run beside MeoCord's own
  dispatch of those events, not in place of it.

## Guards on events

A global guard written for interactions should skip events. Declare which calls it takes:

::example{file="guards/maintenance.guard.ts" region="guard"}

At startup, in an app with `@On` or `@Once` handlers, MeoCord names each global guard or interceptor without
`types`, since it will also run on events.

## Errors

An error a handler throws goes to its [exception filters](guide:exception-filters), as a command's does. One no
filter handles is logged with the event and the handler's name. It never stops the bot, or the other handlers
of that event.

A [`UserError`](api:responses/UserError) is answered where there is someone to answer. For an event with a
message, such as `messageCreate`, its message is sent as a reply to that message, or to the edited one for
`messageUpdate`. Other events have no one to answer, so nothing is sent.

## Intents

Most events need an intent: `guildMemberAdd` needs `GuildMembers`, which is privileged. At startup MeoCord warns
once for each intent or partial a handler needs that `clientOptions` lacks.

A privileged intent is also enabled in the Discord developer portal, under Bot, then Privileged Gateway
Intents. If Discord refuses one at login, the bot says which, and `app.start()` rejects with an error
`isExplainedError(error)` recognises, so the generated `main.ts` doesn't log it twice.

## Testing

`module.emit(event, ...args)` sends an event to the module's handlers through the same pipeline, and resolves
to how many ran:

::example{file="controllers/event/welcome.controller.spec.ts" region="spec"}

`emit` rejects once every handler has settled if any threw: with that error, or an `AggregateError` when
several did.

## Gotchas

- **Nothing runs.** Check the startup warnings for a missing intent. `guildMemberAdd` without `GuildMembers`
  is never emitted.
- **Two classes with one name.** `@Once` tells classes apart by name, so the bot refuses to start when two
  classes share a name and either has a `@Once` handler. Rename one.
- **A global guard denies every event.** It was written for interactions. Give it `types: ['interaction']`.

## Build it

When the bot joins a server, it tells the server how to leave feedback:

::example{file="tutorial/welcome.controller.ts" region="gateway-events"}

Add `WelcomeController` to the app's `controllers`. `guildCreate` needs only the `Guilds` intent the bot
already has. `systemChannel` is `null` in a server without one, so the bot sends nothing there.

## Next steps

- [Lifecycle hooks](guide:lifecycle-hooks): start and stop work with the bot.
- [Guards](guide:guards): decide which calls a guard takes.
- [Exception filters](guide:exception-filters): answer an event's errors your own way.
