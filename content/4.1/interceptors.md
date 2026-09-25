---
id: interceptors
title: Interceptors
section: Handling a call
order: 32
since: 4.1.0
---

An interceptor runs around a handler once its guards have let the call through: for timing, logging,
reporting errors or caching. It receives the call's `ExecutionContext` and continues with `next.handle()`,
which resolves to what the handler returns. It can act before and after the handler, skip it by returning
without calling `next.handle()`, or catch the error the handler throws and throw another. Call
`next.handle()` at most once: each call runs the handler again.

::example{file="interceptors/timing.interceptor.ts" region="interceptor"}

One instance of an interceptor serves every call, so it can inject services and hold a cache; keep per-call
state in local variables. For the same reason it cannot inject `ExecutionContext`, which is per call; the bot
refuses to start if one does. Options for one use go through `{ provide, params }`, read with
`context.getParams()`.

::example{file="interceptors/reporting.interceptor.ts" region="interceptor"}

## The call's params

`context.getHandlerParams()` reads the handler's params as they stand when the interceptor asks: raw before
`next.handle()`, validated and piped after it, as the handler received them. `context.getArgs()` follows the
same stages. An audit interceptor can record both:

::example{file="interceptors/audit.interceptor.ts" region="interceptor"}

On a button whose `uid` is validated and piped into an account:

::example{file="controllers/button/redeem.button.controller.ts" region="controller"}

::example{file="controllers/button/redeem.button.controller.spec.ts" region="spec"}

## Where interceptors apply

`@UseInterceptor` goes on a method, or on a controller for every handler it declares or inherits, and
`@MeoCord({ interceptors })` wraps every handler. Global interceptors are outermost, then the controller's,
then the method's; within one decorator, the first listed is outermost:

::example{file="controllers/slash/lookup.slash.controller.ts" region="controller"}

Interceptors run when a handler is dispatched, and under `invoke` in a test. A controller method called
directly runs none, and autocomplete handlers run none. Global interceptors also wrap gateway event handlers;
`@Interceptor({ types: ['interaction'] })` limits one to interactions, as the reporting interceptor above is.

## Testing

A testing module resolves an interceptor's dependencies from its providers, so a stand-in replaces the real
reporter:

::example{file="controllers/slash/lookup.slash.controller.spec.ts" region="spec"}

Generate an interceptor with `npx meocord g i <name>`.
