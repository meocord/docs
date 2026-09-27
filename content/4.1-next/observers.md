---
id: observers
title: Observers
chapter: pipeline
order: 7
summary: Hear about every call MeoCord dispatches, as it starts and once it has settled, for metrics, audit logs and traces.
learn:
  - Record every call and how it ended with an observer
  - Read a call's outcome, duration and answer
  - Trace a call from start to finish, and pair it with a span inside the handler
requires: [how-a-call-runs, services]
api:
  [decorators/Observer, types/DispatchObserver, types/DispatchResult, types/DispatchOutcome, utilities/ExecutionContext]
since: 4.1.0
---

An observer is told about every call MeoCord dispatches: commands, components, modals, autocomplete, message, reaction
and event handlers, and interactions no handler matches. It hears about each once it has settled, with how it ended
and how long it took, and optionally as it starts.

## When to use it

Use an observer for metrics, audit logs and traces: anything that must see every outcome. No other stage does. Guards
run before anything is decided, interceptors never see a call a guard denied or an autocomplete, and filters see only
errors.

An observer only watches. To change a call, such as timing the handler and logging inside it, use an
[interceptor](guide:interceptors); to answer an error, an [exception filter](guide:exception-filters).

## Example

An observer implements `onSettled`, which receives the call's `ExecutionContext` and how it ended:

::example{file="observers/metrics.observer.ts" region="observer"}

List it in `@MeoCord({ observers })`:

::example{file="app-with-observers.ts" region="app"}

Every call is now recorded with its type, its handler, its outcome and how long it took, the denied and failed ones
included.

## How it works

An observer frames the whole call. `onStart`, which is optional, hears about it as it begins, before
[`@Defer`](guide:defer) and the guards. `onSettled` hears about it once it has settled and been answered, by the
handler, a filter or the fallback. [How a call runs](guide:how-a-call-runs) shows the stages in between.

The call waits for neither method, so a slow observer never delays a handler. One that throws is logged through
`Logger`, and the other observers still run. They're told one after another, in the order `observers` lists them.

An observer is a class marked [`@Observer()`](api:decorators/Observer) that implements
[`DispatchObserver`](api:types/DispatchObserver). One instance is resolved from the container, so it injects services,
and its `onReady` and `onShutdown` [lifecycle hooks](guide:lifecycle-hooks) run in dependency order with the rest: an
exporter flushes what it buffered in `onShutdown`. It can't inject `ExecutionContext`; each call's context is passed
in.

## What an observer is told

`onSettled`'s second argument, a [`DispatchResult`](api:types/DispatchResult), holds:

| Field        | What it is                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `outcome`    | How the call ended; see below.                                                                               |
| `startedAt`  | When dispatch received the call, in milliseconds since the Unix epoch.                                       |
| `durationMs` | From dispatch until the filters and the fallback had answered.                                               |
| `deniedBy`   | The guard class that denied the call, whether it returned `false` or threw `GuardDeniedError`.               |
| `response`   | For an interaction, where its answer stood: `'replied'`, `'deferred'` (never followed up) or `'unanswered'`. |
| `error`      | The error the call ended with, when it ended with one.                                                       |
| `handled`    | Whether an exception filter or the built-in fallback answered the error; `false` without one.                |

The [`outcome`](api:types/DispatchOutcome) is one of:

| Outcome       | When                                                                                                                                            |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `'ran'`       | The call settled without an error, an interceptor that answered without the handler included.                                                   |
| `'denied'`    | A guard returned `false` (no `error`) or threw `GuardDeniedError`.                                                                              |
| `'cooldown'`  | A [cooldown](guide:cooldowns) refused it with `CooldownError`.                                                                                  |
| `'invalid'`   | [Validation](guide:validation) refused its input with `ValidationError`, or a message named a command it doesn't fit, with `MessageUsageError`. |
| `'refused'`   | A `UserError` told the user what to fix: their mistake, not a fault of the bot.                                                                 |
| `'error'`     | Anything else was thrown, by the handler, a pipe, an interceptor or a guard.                                                                    |
| `'not-found'` | No handler matches the interaction and nothing else answered it.                                                                                |

The context is the one the call's stages saw, so `getType()`, `getHandlerName()`, `getArgs()` and `getHandlerParams()`
read the same values. For an interaction no handler matched, it has no controller or handler.

## What is reported

- Every interaction, the ones no handler matches included; those get `onSettled` only. A button, select menu or
  modal no route takes that another listener answers, such as a collector, is that listener's to report, and isn't
  told.
- Every message and reaction a handler runs for, and every event handler call.
- A message that names a command but doesn't fit it, such as a word of the wrong type, as `'invalid'`. A parent
  command's words alone, answered with its subcommands, reach no handler, and are reported without one.
- Not a message no handler matches otherwise: most of a server's traffic would reach the observers for nothing.

`@Observer({ types: ['interaction'] })` limits an observer to those calls, as `ExecutionContext.getType()` reports
them.

## An audit log

This observer writes each refused interaction to an audit log, with the guard that refused it, and warns when a handler
deferred and never answered, which leaves the user on "thinking…":

::example{file="observers/audit.observer.ts" region="observer"}

## Tracing a call

`onSettled` receives the same context object as `onStart` for the same call, so a `WeakMap` pairs them. That gives a
span for every call, a denied one or one no handler matched included:

::example{file="observers/call-span.observer.ts" region="observer"}

An observer sees the call from outside, though. A span for work inside the handler, such as a database query nested
under the command, comes from an interceptor, which runs within the call and can make its span the active one:

::example{file="interceptors/handler-span.interceptor.ts" region="interceptor"}

Register both: the observer in `observers`, the interceptor in `interceptors`. Without an OpenTelemetry SDK set up,
`@opentelemetry/api` records nothing, so the two cost nothing until the bot exports traces.

## Testing

`invoke` and `emit` wait for the module's observers before they resolve, so a test sees what they were told. The
testing module takes an app's observers, and `observers` of its own:

::example{file="observers/audit.observer.spec.ts" region="spec"}

Generate an observer with `npx meocord g ob <name>`: it logs each call's type, handler, outcome and duration, to start
from.

## Gotchas

- **An observer can't change a call.** It runs outside it, and nothing it returns or throws reaches the user.
- **`@Observer({ types: [] })` throws** as the decorator applies. Leave `types` out to hear every call.
- **A message nobody handles isn't reported.** Count those in an `@On('messageCreate')` handler if you need them.

## Next steps

- [Custom decorators](guide:custom-decorators): name a set of stages once and reuse it.
- [Testing recipes](guide:testing-recipes): assert on what your observers were told.
- [Deployment](guide:deployment): export metrics and traces from a running bot.
