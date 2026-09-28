---
id: exception-filters
title: Exception filters and UserError
chapter: pipeline
order: 6
summary: Tell the user about their own mistakes with UserError, and answer any other error your own way with an exception filter.
learn:
  - Refuse a call the user can fix with UserError
  - Answer an error your own way with an exception filter
  - Know what the built-in fallback tells the user, and when
requires: [how-a-call-runs, responses]
api:
  [
    responses/UserError,
    decorators/Catch,
    decorators/UseFilter,
    types/ExceptionFilter,
    responses/CommandNotFoundError,
    responses/ResponseState,
  ]
since: 4.1.0
---

Errors in a call come in two kinds. Some are the user's own mistake, such as too few coins, and the user should be
told what to change. Others are faults in the bot, which the user can do nothing about.

For the first kind, throw [`UserError`](api:responses/UserError): MeoCord shows its message only to the user who made
the call. For anything else, the built-in fallback answers with a generic message and logs the error. When you want
another answer, an exception filter catches the error first and answers it your own way.

## When to use it

Throw `UserError` from a handler, a service, a pipe or a guard whenever the user can fix the problem: an amount over
their balance, an item they don't own, a name already taken.

Write an exception filter when an error needs an answer the fallback can't give: in the user's language, with a link to
a status page, or for an error type of your own. A filter also catches MeoCord's own errors, such as a
[cooldown](guide:cooldowns)'s `CooldownError`.

To stop a call before it starts, use a [guard](guide:guards); a guard's `GuardDeniedError` is answered the same way a
`UserError` is.

## Example

::example{file="controllers/slash/transfer.slash.controller.ts" region="user-error"}

A `/transfer` of more coins than the user holds doesn't change the balance, and the user is told privately what they're
short of. The error is logged only at debug level, since the bot did nothing wrong, and observers see the outcome
`'refused'`. `code` and `context` let a filter or a presenter phrase it otherwise, such as in the user's language.

Subclass it to name your own errors, `class NotEnoughCoinsError extends UserError`: the fallback answers every subclass
the same way, and a filter can `@Catch(NotEnoughCoinsError)` to word that one otherwise.

## How it works

Filters surround every stage of a call, so an error from the guards, the interceptors, validation, a pipe, a cooldown
or the handler reaches them. [How a call runs](guide:how-a-call-runs) shows the order.

A filter is a class marked [`@Catch`](api:decorators/Catch) with the error types it handles, matched with `instanceof`.
With no types, it handles every error. It implements [`ExceptionFilter`](api:types/ExceptionFilter), whose `catch`
receives the error and the call's `ExecutionContext`:

::example{file="filters/rate-limited.filter.ts" region="filter"}

`context.response` is the same [`respond()`](guide:responses) state the handler was using, so a filter answers where
the handler left off: it replies, edits the deferred reply or follows up, whichever the answer allows.

When an error is thrown, MeoCord tries the filters closest to the handler first:

1. the method's `@UseFilter`;
2. the controller's;
3. the global ones, from `@MeoCord({ filters })`.

Within one list, the first filter whose `@Catch` matches handles the error. An error no filter handles goes to the
built-in fallback. A filter that throws is logged, and the fallback answers the original error.

::example{file="controllers/slash/quote.slash.controller.ts" region="controller"}

One instance of a filter serves every call, so it can inject services. It can't inject `ExecutionContext`, which is
`catch`'s second argument instead. Options for one use go through `{ provide, params }`, read with
`context.getParams()`.

## The call's params

`context.getHandlerParams()` gives a filter the handler's params as they stood when the error was thrown: raw when
validation or a pipe threw, validated and piped when the handler did. A filter can answer with what the user asked for:

::example{file="filters/unknown-account.filter.ts" region="filter"}

## Errors outside a handler

An interaction no handler matches, such as a button whose customId fits no pattern, raises
[`CommandNotFoundError`](api:responses/CommandNotFoundError). Only global filters see it, and its context has no
controller or handler. Catch it globally to answer an expired button in your own words.

## The built-in fallback

The fallback logs an error no filter handled, then answers the user through `respond()` if the interaction can still
take an answer, in the style of the app's [presenter](guide:presenters):

| The interaction                                        | The fallback                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| Not answered yet                                       | replies privately                                                 |
| A command whose reply is deferred                      | edits the deferred reply into the error                           |
| A button, select menu or modal on an ephemeral message | adds the error to that message, if it fits                        |
| Any other button, select menu or modal                 | follows up privately; it never edits the message the user clicked |
| Autocomplete                                           | closes the menu with an empty list                                |
| Expired (Discord error 10062)                          | logs only                                                         |

An error that doesn't fit the message it would edit, such as one past Discord's limit of embeds, follows up privately
instead.

It says "An error occurred while executing the command." for a fault, and "Command not found!" for
`CommandNotFoundError`, both in the user's language when the app's translator has them; see
[MeoCord's own texts](guide:localisation#meocords-own-texts). A `UserError`, a guard's `GuardDeniedError`, a
`CooldownError` and a `ValidationError` show their own message, only to the caller: on a public deferred command, the
deferral is deleted and the message follows up privately.

After a message command, the fallback replies to the message, without a ping, with a `UserError`'s message. A guard's
or validation's reason is replied the same way and deleted after `@MeoCord({ messages: { deleteUsageRepliesAfter } })`
seconds. Other errors of message, reaction and event handlers are only logged. The fallback never throws.

## Failures never end the process

An error anywhere in a call is caught, so a handler or a stage that throws or rejects never ends the bot's process:

- **Inside a handler's call,** the filters and then the built-in fallback receive it, as above.
- **Before a handler is reached,** such as for an interaction no handler matches, or one that fails while its handler
  is looked up, the global filters receive it, and the fallback still answers the user.
- **In an event handler,** each call is isolated: its error is logged with the event and the handler, and the next
  listener still runs.
- **In MeoCord's own Discord listeners,** such as the one for `clientReady`, a rejection is logged against the event
  rather than left as an unhandled rejection, which would end the process.

The fallback itself never throws: an answer Discord refuses is logged.

## Testing

Filters run under `invoke`, which resolves with the `error` a filter handled. The fallback doesn't run under `invoke`:
an error no filter handles rejects, so the test sees it.

::example{file="controllers/slash/quote.slash.controller.spec.ts" region="spec"}

To test what the user is told for an error no filter handles, a `UserError` included, use `dispatch`, which answers as
the bot does:

::example{file="controllers/slash/transfer.slash.controller.spec.ts" region="spec"}

Generate a filter with `npx meocord g f <name>`.

## Gotchas

- **A filter without `@Catch` stops the bot at startup.** `@Catch()` with no types handles every error.
- **A plain `Error` tells the user nothing useful.** If the user can fix the problem, throw `UserError` instead, and
  its message reaches them.
- **A global filter catches everything the others don't.** List specific filters on the controller or method, and
  keep the global ones for what every handler shares, such as `CommandNotFoundError`.

## Build it

The review buttons keep working after a restart, but the bot keeps feedback in memory, so a click on a post from before
the restart makes `FeedbackService` throw `FeedbackNotFoundError`. Without a filter, the member would see the generic
error. Answer it in their words:

::example{file="tutorial/feedback-not-found.filter.ts" region="filter"}

Apply it to both review buttons, on the controller:

::example{file="tutorial/review.controller.ts" region="step:exception-filters"}

Restart the bot and press Approve on a post from before the restart: only you are told that the feedback no longer
exists.

## Next steps

- [Observers](guide:observers): count refused calls and errors, with the outcome each ended with.
- [Presenters](guide:presenters): style every error the fallback shows.
- [Localisation](guide:localisation): give a filter's answer in the user's language, as the Build it filter does.
