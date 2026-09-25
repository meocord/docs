---
id: services
title: Services and injection
section: Core
order: 16
---

A service is a class marked with `@Service()`. It holds what handlers share: an API client, a database
connection, a cache, the logic a command calls. A controller, or another service, gets one by declaring it
in its constructor, and MeoCord passes it in.

::example{file="services/greeting.service.ts" region="service"}

Every controller and service is a singleton: one instance serves every call. Keep
per-call state in the handler, not on the instance.

## What you can inject

- **Your own services**, and whatever they inject in turn. A controller that injects a service is enough to
  bind it; nothing has to be listed.
- **The discord.js `Client`**, the one the bot logs in with.
- **`HandlerRegistry`** from `meocord/core`, which lists every handler, and **`ShardContext`**, which reaches
  every shard.
- **`Translator`**, when the app configures `i18n`.
- **Anything a [provider](#providers) supplies**: a value, an instance of another class, or what a factory
  returns, under a class, a string, a symbol or a token from `createToken`.

## Services nothing injects

A service that no controller or other service depends on, but that must still exist, such as a scheduler or
a queue consumer, is listed in the app's `services`:

::example{file="app-with-services.ts" region="app"}

This one sets the bot's status once it is ready, through the `onReady` lifecycle hook:

::example{file="services/status.service.ts" region="service"}

## Providers

Not everything a bot shares is a class it can construct itself. A connection pool is built by a library, a
settings object is a plain value, and an abstract class needs something else to stand in for it. The app's
`providers` supply these, and classes inject them like any service:

::example{file="app-with-providers.ts" region="app"}

A value has no class to be injected by, so it gets a token. `createToken` makes one, typed with what it
provides, and `@Inject(token)` asks for it:

::example{file="services/weather/weather.source.ts" region="token"}

An abstract class is a token and a type at once, so a class that injects it needs no decorator. What
arrives is whatever provides it:

::example{file="services/weather/weather.source.ts" region="source"}

::example{file="services/weather/weather.service.ts" region="service"}

Each provider names its token in `provide`, and exactly one way to provide it:

::example{file="services/weather/weather.providers.ts" region="providers"}

| Shape                     | What is injected                                                                |
| ------------------------- | ------------------------------------------------------------------------------- |
| `{ provide, useValue }`   | The value, as it is.                                                            |
| `{ provide, useClass }`   | One instance of that class, with its own dependencies injected.                 |
| `{ provide, useFactory }` | What the factory returns, made once. It receives what `inject` lists, in order. |

A factory can be async. MeoCord awaits it, in dependency order, before the bot logs in, so a class that
injects its value never sees a promise. The [database recipe](/docs/4.1/recipe-database) provides a
connection pool this way.

- **Startup stops on a mistake.** A factory that throws stops the bot before login, with the token and the
  error. So does a class that injects a string or symbol token nothing provides, or a token provided
  twice.
- **Tokens MeoCord binds are its own.** `Client`, `HandlerRegistry`, `ShardContext`, `CooldownStore`, and
  `Translator` when the app configures `i18n`, cannot be provided.
- **Lifecycle hooks apply.** A provided value or instance with `onReady` or `onShutdown` gets them, in the
  same dependency order as services; see [Lifecycle hooks](/docs/4.1/lifecycle-hooks).

The testing module takes providers in the same shapes, so a test supplies the settings and the source it
wants:

::example{file="services/weather/weather.controller.spec.ts" region="spec"}

A class that injects a token nothing provides fails when the module compiles, naming both:

::example{file="services/weather/weather.controller.spec.ts" region="missing"}

## Designing a service

Keep Discord at the edge. A controller reads the interaction and answers it; the service it calls takes
plain values, such as a user id or a string, and returns plain values. Such a service is tested with `new`,
with no module and no mocks, and it can be reused from a button, a command and a scheduled task alike:

::example{file="services/rewards/daily-reward.service.ts" region="reward"}

It depends on a wallet, which stands in for a database:

::example{file="services/rewards/wallet.service.ts" region="wallet"}

### Shared state and `await`

One instance serves every call, and calls interleave at each `await`. Two clicks on the same button can both
pass a check before either records its result. `claim` records the claim before it awaits the payment, so
the second click finds it. It also undoes the record if the payment fails, so the member can try again.
The test runs both claims at once:

::example{file="services/rewards/daily-reward.service.spec.ts" region="spec"}

## Settings

Read configuration once, in a service, rather than from `process.env` inside handlers. The handlers stay
readable, a missing value can fail in one place, and a test replaces the whole service with
`{ provide: Settings, useValue: { ... } }`. The tutorial's
[`FeedbackSettings`](/docs/4.1/tutorial-components#where-feedback-goes) is a small example.

## Services around a handler

Guards, interceptors and exception filters inject services the same way controllers do:

- A **guard** is created for each call, so it may also inject `ExecutionContext`. The tutorial's
  [staff guard](/docs/4.1/tutorial-guards) reads the staff role from a settings service.
- An **interceptor** or **filter** is one instance shared across calls, like a service, so it holds no
  per-call state and cannot inject `ExecutionContext`; it receives the context as an argument instead.

## Services that need each other

Two services that inject each other lose a constructor type: the one whose file loads second records the
other's type before that class exists. MeoCord stops the bot before it binds anything, and names the
class, the parameter and the classes that inject it:

```text
Notes cannot be created: parameter 1 of its constructor has no runtime type. Usually Notes and a class it
injects import each other (NotesController injects Notes), or the parameter is typed with an interface or
an `import type`. Move what they both need into a third service, or inject the parameter with @Inject(token).
```

Move what both need into a third service that each of them injects. A cycle usually means one of the two
does two jobs. `meocord/eslint` warns about import cycles as you write them; see
[ESLint](/docs/4.1/eslint).

## Startup and shutdown

A service that connects to something, or runs a timer, starts in `onReady` and stops in `onShutdown`. The
hooks run in dependency order, so a service's dependencies are ready before it. See
[Lifecycle hooks](/docs/4.1/lifecycle-hooks).

## Testing a service

`MeoCordTestingModule` builds a container from the classes you give it. Unlike the app, it binds only what
you list, so a test decides each dependency: the real class, or a stand-in with `useValue`.

::example{file="services/status.service.spec.ts"}
