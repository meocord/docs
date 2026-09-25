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

## Services nothing injects

A service that no controller or other service depends on, but that must still exist, such as a scheduler or
a queue consumer, is listed in the app's `services`:

::example{file="app-with-services.ts" region="app"}

This one sets the bot's status once it is ready, through the `onReady` lifecycle hook:

::example{file="services/status.service.ts" region="service"}

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

Two services that inject each other fail when their files load, before the bot starts: one class is not
defined yet when the other's constructor types are recorded. Move what both need into a third service that
each of them injects. A cycle usually means one of the two does two jobs.

## Startup and shutdown

A service that connects to something, or runs a timer, starts in `onReady` and stops in `onShutdown`. The
hooks run in dependency order, so a service's dependencies are ready before it. See
[Lifecycle hooks](/docs/4.1/lifecycle-hooks).

## Testing a service

`MeoCordTestingModule` builds a container from the classes you give it. Unlike the app, it binds only what
you list, so a test decides each dependency: the real class, or a stand-in with `useValue`.

::example{file="services/status.service.spec.ts"}
