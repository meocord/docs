---
id: invoke-and-dispatch
title: Invoke and dispatch
chapter: testing
order: 2
summary: Run one handler you name with invoke, or send an input through the bot's routing with dispatch.
learn:
  - Run a handler through the pipeline with invoke
  - Check which handler an interaction, message or reaction reaches with dispatch
  - Read what the user was sent with getResponse
requires: [testing]
api:
  [testing/TestingModule, testing/getResponse, testing/inspectHandler, testing/InvocationResult, testing/DispatchedCall]
since: 4.1.0
formerly: [invoke]
---

A testing module runs handlers in two ways. `invoke` runs the handler you name, through everything the bot runs
around it. `dispatch` hands the module an input, an interaction, a message or a reaction, and lets it find the
handlers the way the bot does.

Both run the whole pipeline, and both leave a record of what the user was sent.

## When to use it

Use `invoke` for most handler tests: you know which handler you're testing, and you want its guards, validation and
answer checked. The method name and its arguments are type-checked against the handler.

Use `dispatch` when routing is the question: which handler a `customId`, a command or a message reaches, with which
params, and what the user sees when nothing matches. It also answers errors with the built-in fallback, as the bot
does, so it shows the member's view of a failure.

To check a route without running anything, [`resolveRoute`](api:testing/resolveRoute) is lighter. To test a service
on its own, build it with `new`.

## Example

::example{file="testing/dispatch.spec.ts" region="dispatch"}

The click's `customId`, `card/42/like`, reaches `CardButtonController.like` through the module's routing table.
`handlers` lists every handler it ran, and [`getResponse`](api:testing/getResponse) shows the update the handler
sent.

## How it works

Both run the handler through the [pipeline](guide:how-a-call-runs): `@Defer`, guards, interceptors around
validation, pipes, cooldowns and the handler, all inside its exception filters. Guards and filters resolve from the
module, so `overrideGuard` stubs work, and so does an injected `ExecutionContext`.

They differ in where the handler comes from, and in what happens to an error:

|                            | `invoke(Controller, 'method', ...args)`       | `dispatch(input)`                     |
| -------------------------- | --------------------------------------------- | ------------------------------------- |
| Handler                    | the one you name                              | whichever the bot's routing reaches   |
| Params                     | built from the input, as dispatch builds them | the same                              |
| Resolves to                | `{ ran, error? }`                             | `{ ran, handlers, error? }`           |
| An error no filter handles | rejects, and the fallback doesn't run         | the fallback answers, then it rejects |
| The user's own outcome     | a refusal rejects                             | answered, and resolves with `error`   |

The user's own outcome is a usage reply, an unknown command, or the refusal of a guard, a cooldown or the cooldown
store, a validation or a `UserError`. Both wait for the module's [observers](guide:observers) before they resolve.

## Running a handler with invoke

Pass the arguments dispatch would: the interaction, message or reaction, then the handler's params. Passed alone, an
interaction gets its params built as dispatch builds them: a command's options, or a component's `customId` params
with a modal's fields or a select menu's choices.

`invoke` resolves to `{ ran }`. `ran` is `false` when a guard stopped the call or an interceptor skipped the handler,
and `error` is set when a filter handled one. A guard that returns `false` stops the call with no answer:

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="invoke"}

A guard that throws `GuardDeniedError`, a handler that throws `UserError`, and a cooldown's `CooldownError` reject
`invoke` with that error, where `dispatch` answers the user and resolves with it as `error`. Assert them with
`await expect(module.invoke(...)).rejects.toThrow(GuardDeniedError)`.

The interaction must be one dispatch routes to the handler, ranking every handler of the module as the bot does. A
`customId` another handler's pattern takes first rejects, naming the handler that runs, and so does one no pattern
takes, or a command the handler doesn't handle, so a typo in a test doesn't pass silently. A handler declared under two
patterns gets the params of the one dispatch picks. A mock built without a `customId` or command name isn't checked.

## Sending input with dispatch

`dispatch` routes over the module's controllers, with its `app`'s message options, exactly as the bot does. A message
reaches its command after the app's prefix:

::example{file="testing/dispatch.spec.ts" region="message"}

A reaction takes the user who reacted and, optionally, the action; it's an add unless you say otherwise:

::example{file="testing/dispatch.spec.ts" region="reaction"}

`handlers` lists each handler reached, in the order it ran, with its own `ran` and `error`. A message can reach a
patterned handler and every `@MessageHandler()` listener at once, and a reaction several handlers.

### When nothing matches

An input no route takes is answered as the bot answers it: "Command not found!" for an interaction, and an empty list
for an autocomplete. The call resolves with the error, and no handler in `handlers`:

::example{file="testing/dispatch.spec.ts" region="not-found"}

Whatever the bot skips reaches nothing: a message from a bot, or a bot's reaction to a handler without
`bots: true`, resolves to `{ ran: false, handlers: [] }`.

A button, select menu or modal submission no route takes may belong to a collector. When the interaction's client has
another `interactionCreate` listener, `dispatch` waits the same 1.5 seconds the bot does before answering "not
found", and says nothing if the listener answered first. A mock's own client has no listeners, so the answer is
immediate. See [Components](guide:components#collectors).

## Reading what was sent

[`getResponse(interaction)`](api:testing/getResponse) reports every answer a mock interaction got, whether the
handler made it through `respond()` or with discord.js directly, such as `interaction.reply()` or
`interaction.followUp()`:

- `state`: where the answer stands, `'unanswered'`, `'deferred'` or `'replied'`;
- `sent`: whether a reply, an update, an edit or a follow-up went out, counting only the calls Discord accepted;
- `calls`: each answer, once, in the order made, with what it sent, and the `error` of one Discord refused.

A call a mock rejects, such as a reply refused with 10062 once the three seconds have passed, stays in `calls` with its
`error`, and doesn't count as sent: the member saw nothing.

For messages and reactions, read the mock's own methods, such as `message.reply`.

## Events and handler setup

To send a gateway event to the module's `@On` and `@Once` handlers, use `module.emit(event, ...args)`. It resolves to
`{ ran }`, how many handlers ran, and once every handler has settled, rejects if any threw: with that error, or an
`AggregateError` naming each.

To check what a handler is set up with, without running it, use [`inspectHandler`](api:testing/inspectHandler). It
lists the guards, interceptors, filters and cooldowns dispatch applies, in order, and reads the handler's metadata
as `ExecutionContext` does. [Testing recipes](guide:testing-recipes#guards) has an example.

## Gotchas

- **`invoke` refuses an input dispatch gives to another handler.** Beside `roll {sides}`, a handler for `roll 20` wins
  the message `!roll 20`, and beside `card/{id}`, a handler for `card/summary` wins that click. Invoking the first of
  each pair with it rejects, naming the handler that runs. Invoke the handler dispatch picks, or dispatch the input.
- **An unhandled error rejects both.** With `dispatch`, the member still got the fallback's answer first. Assert the
  rejection with `await expect(...).rejects.toThrow(...)`, and read `getResponse` after it.
- **A collector's click needs the bot's client.** A click built with a fresh mock client isn't the client the call
  came to. Build it with `{ client: interaction.client }`, as [Mocks](guide:mocks#collectors) shows.

## Build it

Each part of the feedback bot has a spec. Add one that runs the whole flow, from the form to the author's DM, through
the same pipeline the bot uses. Ada submits in Indonesian, Grace approves, and the test checks what each of them
sees:

::example{file="tutorial/feedback.flow.spec.ts" region="spec"}

The review post Grace clicks is built from what the bot actually sent. `resolveRoute(App, ...)` confirms the
button's `customId` reaches `approve`, and `app: App` applies the app's presenter, so the loading view is the real one,
in Grace's language. Run `npm test` to see the flow pass.

## Next steps

- [Mocks](guide:mocks): building the interactions, messages and reactions these take.
- [Testing recipes](guide:testing-recipes): guards, cooldowns, themes and collectors.
- [How a call runs](guide:how-a-call-runs): the pipeline both of them run.
