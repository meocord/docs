---
id: guards
title: Guards
section: Handling a call
order: 31
---

A guard decides whether a handler runs. It implements `canActivate`, returning `true` to let the call through
and `false` to stop it silently. To tell the user why, throw `GuardDeniedError` from `meocord/common` with
the message to show; it is answered only to the user who made the call.

A new guard instance is created for every call, so keep state that must outlast one call, such as counts,
outside the guard: in a service, which is a singleton. Do not list the guard class itself in the app's
`services`: one shared instance would take every call's options, and the bot warns at startup.

## Options for one use

When a value configures one use of a guard, such as the channels a command is allowed in, pass it with
`@UseGuard({ provide, params })`. The params are set on the guard instance before `canActivate` runs, and a
decorator of your own can wrap it:

::example{file="guards/channel.guard.ts" region="guard"}

## Facts about the handler

For facts about a handler that any guard can read, use metadata. `createMetadata` makes a typed decorator for
a controller, a handler, or both; a guard reads it through `ExecutionContext`, and the handler's value wins
over the controller's:

::example{file="guards/roles.guard.ts" region="guard"}

Both apply like any decorator:

::example{file="controllers/slash/moderation.slash.controller.ts" region="apply"}

`ExecutionContext` is injected only into guards: each call gets its own, so a controller or service, which
is shared across calls, cannot inject it. It also gives the handler's arguments (`getArgs()`,
`getInteraction()`, `getMessage()`, `getReaction()`), what is being handled (`getType()`), the controller and
method (`getController()`, `getHandlerName()`), and the guard's own params (`getParams()`).

## Where guards apply

`@UseGuard` goes on a method, or on a controller for every handler it declares or inherits. For a subclass,
its own class guards run first, then the base class's, then the method's. To guard every handler in the
bot, list guards in `@MeoCord({ guards })`; they run before the controller's and the method's.

A guard runs for every kind of handler it applies to, global guards included, which also run before gateway
event handlers. `@Guard({ types: ['interaction'] })` limits one to interactions.

Class and global guards also run before autocomplete handlers. There the guard receives an
`AutocompleteInteraction`, which cannot be replied to, so it must not answer: returning `false` closes the
menu with an empty list.

## Testing

`invoke` runs a handler with its guards; `ran` is `false` when one stopped it. A guard can also be tested
alone, with `createExecutionContext` building its context, and `inspectHandler` lists what a handler is set
up with:

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="invoke"}

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="unit"}

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="inspect"}
