---
id: observers
title: Observers
section: Handling a call
order: 35.5
since: 4.1.0
---

An observer is told about every call MeoCord dispatches, once it has settled: commands, components, modals,
autocomplete, message, reaction and event handlers, and interactions no handler matches. It is where
metrics and audit logs go, since no other stage sees every outcome: guards run before anything is decided,
interceptors never see a call a guard denied or an autocomplete, and filters see only errors.

## Recording every call

An observer implements `onSettled`, which receives the call's `ExecutionContext` and how it ended:

::example{file="observers/metrics.observer.ts" region="observer"}

List it in `@MeoCord({ observers })`:

::example{file="app-with-observers.ts" region="app"}

## What an observer is told

`onSettled`'s second argument, a `DispatchResult`, holds:

| Field        | What it is                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `outcome`    | How the call ended; see below.                                                                                            |
| `startedAt`  | When dispatch received the call, in milliseconds since the Unix epoch.                                                    |
| `durationMs` | From dispatch until the filters and the fallback had answered, from `performance.now()`.                                  |
| `deniedBy`   | The guard class that denied the call, whether it returned `false` or threw `GuardDeniedError`.                            |
| `response`   | For an interaction, where its answer stood: `'replied'`, `'deferred'` (deferred and never followed up) or `'unanswered'`. |
| `error`      | The error the call ended with, when it ended with one.                                                                    |
| `handled`    | Whether an exception filter or the built-in fallback answered the error; `false` without one.                             |

| Outcome       | When                                                                                                                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `'ran'`       | The call settled without an error, an interceptor that answered without calling `next.handle()` included.              |
| `'denied'`    | A guard returned `false` (no `error`) or threw `GuardDeniedError`.                                                     |
| `'cooldown'`  | A [`@Cooldown`](/docs/4.1/cooldowns) refused it with `CooldownError`.                                                  |
| `'invalid'`   | [`@Validate`](/docs/4.1/validation) refused its input with `ValidationError`.                                          |
| `'error'`     | Anything else was thrown, by the handler, a pipe, an interceptor or a guard.                                           |
| `'not-found'` | No handler matches the interaction: `CommandNotFoundError`, or an autocomplete no `@Autocomplete` claims (no `error`). |

The context is the one the call's stages saw, so `getType()`, `getHandlerName()`, `getArgs()` and
`getHandlerParams()` read the same values. For an interaction no handler matched, it has no controller or
handler.

## An audit log

An observer is a singleton service: one instance is resolved from the container, so it injects services.
This one writes each refused interaction to an audit log, with the guard that refused it, and warns when a
handler deferred and never answered, which leaves the user on "thinking…":

::example{file="observers/audit.observer.ts" region="observer"}

## What is reported

- Every interaction, the ones no handler matches included.
- Every message and reaction a handler runs for, and every event handler call.
- Not a message no handler matches: messages are not commands, and most of a server's traffic would reach
  the observers for nothing.

## Rules

- **Read-only.** An observer runs outside the call, and the call waits for none of its methods, so a slow
  observer never delays a handler. One that throws is logged through `Logger`, and the others still run.
- **In order.** Observers are told one after another, in the order `observers` lists them.
- **By type.** `@Observer({ types: ['interaction'] })` is told only about those calls, as
  `ExecutionContext.getType()` reports them. An empty list throws, and a subclass inherits the types unless
  it declares its own.
- **A service.** Its `onReady` and `onShutdown` [lifecycle hooks](/docs/4.1/lifecycle-hooks) run in
  dependency order with the rest, so an exporter flushes what it buffered in `onShutdown`, before the
  services it uses shut down. It cannot inject `ExecutionContext`: each call's context is passed in.

## Tracing a call

`onStart`, which is optional, receives the call as it begins, before [`@Defer`](/docs/4.1/defer) and the
guards. `onSettled` for the same call receives the same context object, so a `WeakMap` pairs them. That gives
a span for every call, a denied one or one no handler matched included:

::example{file="observers/call-span.observer.ts" region="observer"}

An observer sees the call from outside, though. A span for work inside the handler, such as a database query
nested under the command, comes from an [interceptor](/docs/4.1/interceptors), which runs within the call and
can make its span the active one:

::example{file="interceptors/handler-span.interceptor.ts" region="interceptor"}

Register both, as the app [above](#recording-every-call) does: the observer in `observers`, the interceptor
in `interceptors`. Without an OpenTelemetry SDK set up, `@opentelemetry/api` records nothing, so the two cost
nothing until the bot exports traces.

## Testing

`invoke` and `emit` wait for the module's observers before they resolve, so a test sees what they were told.
The testing module takes an `app`'s observers, and `observers` of its own, as
`MeoCordTestingModule.create({ controllers, observers: [AuditObserver] })`.
`inspectHandler(Controller, 'method', { app }).observers` lists the app's observers, in the order they are
told:

::example{file="observers/audit.observer.spec.ts" region="spec"}

## Generating an observer

```shell
npx meocord g ob <name>
```

`observer`, or `ob`, writes `src/observers/<name>.observer.ts` and its spec: an observer that logs each
call's type, handler, outcome and duration, to start from. See the [CLI](/docs/4.1/cli#generators).
