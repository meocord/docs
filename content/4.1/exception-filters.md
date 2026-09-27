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

## The call's params

`context.getHandlerParams()` gives a filter the handler's params as they were when the error was thrown:
raw when a pipe or validation threw, piped when the handler did. A filter can answer with what the user
asked for:

::example{file="filters/unknown-account.filter.ts" region="filter"}

The redeem button [above](/docs/4.1/interceptors#the-calls-params) applies it, so a uid with no account is
answered privately with the text the user sent.

## User errors

Some errors are the user's own mistake, such as too few coins, and the user should be told what to change. Throw
`UserError` from `meocord/common` for those, from a handler, a service, a pipe or a guard:

::example{file="controllers/slash/transfer.slash.controller.ts" region="user-error"}

The built-in fallback shows its message only to the user who made the call: privately after an interaction, and as
a reply to the message, without a ping, after a message command. It is logged only at debug level, since the bot did
nothing wrong, and [observers](/docs/4.1/observers) see the outcome `'refused'`.

Subclass it to name your own errors, `class NotEnoughCoinsError extends UserError`: the fallback answers every
subclass the same way, and a filter can `@Catch` one to word it otherwise. `code` and `context` carry what a filter
or a presenter needs to phrase the message another way, such as in the user's language.

To test what the user is told, `dispatch` the interaction, which answers as the bot does; `invoke` rejects with the
error, as it does for any error no filter handles:

::example{file="controllers/slash/transfer.slash.controller.spec.ts" region="spec"}

## Failures never take the bot down

An error anywhere in a call is caught, so a handler or a stage that throws or rejects never ends the bot's process:

- **Inside a handler's call,** the filters and then the built-in fallback receive it, as above.
- **Before a handler is reached,** such as for an interaction no handler matches, or one that fails while its
  handler is looked up, the global filters receive it, and the fallback still answers the user.
- **In an event handler,** each call is isolated: its error is logged with the event and the handler, and the next
  listener still runs.
- **In MeoCord's own Discord listeners,** such as the one for `clientReady`, a rejection is logged against the event
  rather than left as an unhandled rejection, which would end the process.

The fallback itself never throws: an answer Discord refuses is logged.

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
`CommandNotFoundError`, a `GuardDeniedError`'s own message, a `CooldownError`'s wait, a `ValidationError`'s list of
issues, and a `UserError`'s own message. The last four stay private even on a public deferred command.

After a message command, the fallback replies to the message, without a ping: with the command's usage when the
message does not fit it, or a guard's or validation's reason, each deleted after
`@MeoCord({ messages: { deleteUsageRepliesAfter } })` seconds. A `UserError`'s message is a reply that stays. A
`UserError` from an event handler replies to the message the event carries, if it carries one. Other errors of
message, reaction and event handlers are only logged. The fallback never throws.

## Testing

Filters run under `invoke`, which resolves with the `error` a filter handled. The fallback does not run in
tests: an error no filter handles rejects, so the test sees it.

::example{file="controllers/slash/quote.slash.controller.spec.ts" region="spec"}

Generate a filter with `npx meocord g f <name>`.
