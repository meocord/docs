---
id: exception-filters
title: Exception filters
section: Handling a call
order: 33
since: 4.1.0
---

An exception filter handles the errors a handler, its interceptors or its guards throw, and decides what the
user is told. `@Catch` names the error types it handles, matched with `instanceof`; with no types, it handles
every error.

::example{file="filters/rate-limited.filter.ts" region="filter"}

A filter reaches the call's answer as `context.response`, the same `respond()` state the handler was using,
so it replies, edits or follows up as the answer stands.

## Where filters apply

`@UseFilter` goes on a method or a controller, and `@MeoCord({ filters })` covers every handler. The filter
closest to the handler wins: the method's are tried first, then the controller's, then the global ones;
within one level, the first whose `@Catch` matches. A filter that throws is logged, and the built-in fallback
answers the original error.

::example{file="controllers/slash/quote.slash.controller.ts" region="controller"}

Errors outside any handler reach global filters too. An interaction no handler matches raises
`CommandNotFoundError`; there, the context has no controller or handler.

As with interceptors, one instance serves every call, so a filter cannot inject `ExecutionContext`, and
`{ provide, params }` is read with `context.getParams()`.

## The built-in fallback

An error no filter handles goes to the built-in fallback. It logs the error, and answers the user through
`respond()` if the interaction can still take an answer, privately and in the style of the app's
[presenter](/docs/4.1/presenters):

| The interaction                                                    | The fallback                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| Not answered yet                                                   | replies                                                 |
| A command, or a modal not from a message, whose reply was deferred | edits the deferred reply into the error                 |
| The same, already replied to                                       | follows up                                              |
| A button, select menu or modal from a public message               | follows up; it never edits the message the user clicked |
| The same, from a private message                                   | adds the error to that message                          |
| Autocomplete                                                       | closes the menu with an empty list                      |
| Expired (Discord error 10062)                                      | logs only                                               |

It says "An error occurred while executing the command.", or "Command not found!" for
`CommandNotFoundError`, a `GuardDeniedError`'s own message, a `CooldownError`'s wait, and a
`ValidationError`'s list of issues. The last three stay private even on a public deferred command. Errors
from message, reaction and event handlers are only logged. The fallback never throws.

## Testing

Filters run under `invoke`, which resolves with the `error` a filter handled. The fallback does not run in
tests: an error no filter handles rejects, so the test sees it.

::example{file="controllers/slash/quote.slash.controller.spec.ts" region="spec"}

Generate a filter with `npx meocord g f <name>`.
