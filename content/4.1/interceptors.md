---
id: interceptors
title: Interceptors
chapter: pipeline
order: 4
summary: Wrap a handler to act before and after it, for timing, logging, caching or reporting its errors.
learn:
  - Write an interceptor that runs code around a handler
  - Skip the handler, or turn its error into another
  - Read the handler's params before and after validation
requires: [how-a-call-runs, services]
api:
  [
    decorators/Interceptor,
    decorators/UseInterceptor,
    types/InterceptorInterface,
    types/CallHandler,
    utilities/ExecutionContext,
  ]
since: 4.1.0
---

An interceptor runs around a handler once its guards have let the call through. It receives the call's
[`ExecutionContext`](api:utilities/ExecutionContext) and a `next` whose `handle()` runs the rest of the call and
resolves to what the handler returns. What it does before `next.handle()` runs before the handler; what it does after,
runs after.

## When to use it

Use an interceptor for work that wraps the call: measuring how long it takes, logging what ran, caching a result,
reporting errors to a tracker, or adding a span around the handler's work.

To decide whether the call runs at all, use a [guard](guide:guards). To answer an error, use an
[exception filter](guide:exception-filters): an interceptor can see the error, but a filter decides what the user is
told. To record every call, the denied ones included, use an [observer](guide:observers), since an interceptor never
sees a call a guard refused.

## Example

::example{file="interceptors/timing.interceptor.ts" region="interceptor"}

Applied with `@UseInterceptor(TimingInterceptor)`, it logs how long each call of the handler took, whether it returned
or threw.

## How it works

Interceptors run after the guards and the fetch of a message's entities. They wrap validation, pipes, the cooldown
count and the handler, so an interceptor sees invalid input or a cooldown as the handler's error. The exception is a
message command's cooldown check before its params are fetched, which runs before the interceptors.

`intercept` decides what happens to the call:

- **It calls `next.handle()` once** to run the rest of the call and gets the handler's result.
- **It returns without calling it** to skip the handler, answering from a cache, say. Observers still see the outcome
  `'ran'`. In development, one that leaves the interaction unanswered this way is named in a warning, as a handler is.
- **It catches the error `next.handle()` throws** and throws another, which the filters then receive.

Call `next.handle()` at most once: each call runs the handler again. Return or await what it returns. One left
without a rejection handler, as `next.handle().then(log)` leaves it, still has the call end when the handler does and
fail with what it throws, so the filters and the fallback answer the error.

One instance of an interceptor serves every call, so it can inject services and hold a cache; keep per-call state in
local variables. For the same reason, it can't inject `ExecutionContext`, which belongs to one call. The bot refuses to
start if one does, and the context is `intercept`'s first argument instead. The reporting interceptor injects its
reporter:

::example{file="interceptors/reporting.interceptor.ts" region="interceptor"}

Options for one use go through `{ provide, params }`, read with `context.getParams()`.

## Where interceptors apply

[`@UseInterceptor`](api:decorators/UseInterceptor) goes on a handler, or on a controller for every handler it declares
or inherits, and `@MeoCord({ interceptors })` wraps every handler in the bot. The global ones are outermost, then the
controller's, then the method's; within one list, the first is outermost:

::example{file="controllers/slash/lookup.slash.controller.ts" region="controller"}

Global interceptors also wrap message, reaction and event handlers. One written for interactions declares
`@Interceptor({ types: ['interaction'] })`, as the reporting interceptor above does. Autocomplete handlers run no
interceptors, since they must answer within three seconds and have no reply to shape.

## The call's params

`context.getHandlerParams()` reads the handler's params as they stand when the interceptor asks: raw before
`next.handle()`, and validated and piped after it, as the handler received them. `context.getArgs()` follows the same
stages. An audit interceptor can record both:

::example{file="interceptors/audit.interceptor.ts" region="interceptor"}

On a button whose `uid` is validated and piped into an account:

::example{file="controllers/button/redeem.button.controller.ts" region="controller"}

::example{file="controllers/button/redeem.button.controller.spec.ts" region="spec"}

## Testing

A [testing module](guide:testing) runs interceptors under `invoke`, and resolves their dependencies from its providers,
so a stand-in replaces the real reporter:

::example{file="controllers/slash/lookup.slash.controller.spec.ts" region="spec"}

Generate an interceptor with `npx meocord g i <name>`.

## Gotchas

- **A controller method called directly runs no interceptors.** Only the testing module and the bot's dispatch run
  them.
- **`next.handle()` called twice runs the handler twice,** with its side effects. Keep its promise if you need the
  result in two places.
- **An interceptor doesn't see denied calls.** Guards run before it; count refusals in an observer.
- **A handler raced against a timeout can throw after the call has ended.** Nothing is left to report it then, so
  MeoCord warns, naming both: "Racing returned before Shop.buy finished, which then threw; nothing caught it, so the
  call could not report it:", then the error. Forwarding it into a promise that has already settled, as
  `(error) => reject(error)` does, discards it unseen: race with `Promise.race`, or handle the error where it arrives.

## Next steps

- [Cooldowns](guide:cooldowns): limit how often the calls an interceptor wraps can run.
- [Exception filters](guide:exception-filters): decide what the user sees when the handler throws.
- [Observers](guide:observers): trace every call from outside, and pair it with an interceptor's span inside.
