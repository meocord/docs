---
id: services
title: Services and injection
chapter: structure
order: 1
summary: Share clients, data and logic between handlers with services MeoCord creates and passes in for you.
learn:
  - Write a service and inject it into a controller
  - Provide values, instances and factories under a token
  - Keep a shared service safe when calls overlap
  - Test a service with or without a module
requires: [slash-commands]
api: [decorators/Service, decorators/Inject, utilities/createToken, decorators/MeoCord]
since: 4.0.0
---

A service is a class marked with [`@Service()`](api:decorators/Service). It holds what handlers share: an API client,
a database connection, a cache, the logic a command calls. A controller, or another service, gets one by declaring
it in its constructor, and MeoCord passes it in.

## When to use it

Move code into a service as soon as two handlers need it, or as soon as a handler does more than read the
interaction and answer it. A service takes plain values and returns plain values, so it can be tested with `new` and
called from a button, a command and a scheduled task alike.

Code used by one handler only can stay in that controller. A value that isn't a class, such as a settings object or a
connection pool a library builds, is [provided](#providers) instead.

## Example

::example{file="services/greeting.service.ts" region="service"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

The controller declares `GreetingService` in its constructor, and MeoCord creates one instance and passes it in.
Nothing has to be listed: a controller that injects a service is enough to bind it, and whatever that service
injects in turn.

## How it works

When the bot starts, MeoCord builds a container from the app's controllers and everything they inject. Every
controller and service is a singleton: one instance serves every call. A class's dependencies are created before
it, so a constructor always receives instances that are ready.

A class can inject:

- **your own services**, and whatever they inject;
- **the discord.js `Client`**, the one the bot logs in with;
- **`HandlerRegistry`** and **`ShardContext`** from `meocord/core`, which list every handler and reach every shard;
- **`Translator`**, when the app configures [localisation](guide:localisation);
- **anything a provider supplies**, under a class or a token.

## Services nothing injects

A service that no controller depends on, but that must still exist, such as a scheduler or a queue consumer, is
listed in the app's `services`:

::example{file="app-with-services.ts" region="app"}

This one sets the bot's status once it's ready, through its `onReady` [lifecycle hook](guide:lifecycle-hooks):

::example{file="services/status.service.ts" region="service"}

## Providers

Not everything a bot shares is a class it can construct itself. The app's
[`providers`](api:decorators/MeoCord#providers) supply these, and classes inject them like any service:

::example{file="app-with-providers.ts" region="app"}

A value has no class to be injected by, so it gets a token. [`createToken`](api:utilities/createToken) makes one,
typed with what it provides, and `@Inject(token)` asks for it:

::example{file="services/weather/weather.source.ts" region="token"}

An abstract class is a token and a type at once, so a class that injects it needs no decorator:

::example{file="services/weather/weather.source.ts" region="source"}

::example{file="services/weather/weather.providers.ts" region="providers"}

| Shape                     | What's injected                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- |
| `{ provide, useValue }`   | The value, as it is.                                                            |
| `{ provide, useClass }`   | One instance of that class, with its own dependencies injected.                 |
| `{ provide, useFactory }` | What the factory returns, made once. It receives what `inject` lists, in order. |

A factory can be async. MeoCord awaits it, in dependency order, before the bot logs in, so a class that injects its
value never sees a promise. The [database recipe](guide:recipes/database) provides a connection pool this way.

## Shared state and await

One instance serves every call, and calls interleave at each `await`. Two clicks on the same button can both pass a
check before either records its result. This service records the claim before it awaits the payment, so the second
click finds it, and undoes the record if the payment fails:

::example{file="services/rewards/daily-reward.service.ts" region="reward"}

The test runs both claims at once:

::example{file="services/rewards/daily-reward.service.spec.ts" region="spec"}

## Services around a handler

Guards, interceptors and exception filters inject services the same way:

- **A guard** is created for each call, so it may also inject `ExecutionContext`.
- **An interceptor or a filter** is one instance shared across calls, like a service. It holds no per-call state
  and can't inject `ExecutionContext`; it receives the context as an argument instead.

## Testing a service

A service that takes plain values is tested with `new`. For one that injects others, `MeoCordTestingModule` builds a
container from the classes you give it, and binds every class they inject, as the app does. It binds no Discord
`Client` and no token, so a test provides those, and it replaces a class only where the test asks, with `useValue`.

::example{file="services/status.service.spec.ts"}

The testing module takes providers in the same shapes as the app, and a class that injects a token nothing provides
fails when the module compiles, naming both:

::example{file="services/weather/weather.controller.spec.ts" region="missing"}

## Gotchas

- **Per-call state on the instance leaks between calls.** Keep it in the handler's variables, or key it by user.
- **Two services that inject each other stop the bot.** The one whose file loads second records the other's type
  before that class exists, and MeoCord names both:

  ```text
  Notes: parameter 1 of its constructor has no runtime type, so it cannot be created. Usually Notes and a class
  it injects import each other (NotesController injects Notes), or the parameter is typed with an interface or
  an `import type`. Move what they both need into a third service, or inject the parameter with @Inject(token).
  ```

  Move what both need into a third service. `meocord/eslint` warns about import cycles as you write them.

- **A factory that throws stops the bot before login,** with the token and the error. So does a token provided
  twice, or one a class injects that nothing provides.
- **MeoCord's own tokens can't be provided:** `Client`, `HandlerRegistry`, `ShardContext`, `CooldownStore`, and
  `Translator` when the app configures `i18n`.

## Next steps

- [Configuration](guide:configuration): read settings once, in a service, rather than from `process.env`.
- [Lifecycle hooks](guide:lifecycle-hooks): start and stop what a service connects to.
- [Mocks](guide:mocks): stand in for a service in a test.
