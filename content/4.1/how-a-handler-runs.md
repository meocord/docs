---
id: how-a-handler-runs
title: How a call runs
section: Handling a call
order: 30
since: 4.1.0
---

Every handler, whether a command, a component, an autocomplete, a message, a reaction or a gateway event,
runs through the same stages, in this order:

1. **`@Defer`, first step:** acknowledges the interaction, so slow stages never miss Discord's three seconds.
2. **Guards** decide whether the handler runs at all.
3. **Interceptors** wrap everything after them: they can act before and after, skip the handler, or replace
   its error.
4. **Validation** checks the handler's input against a schema, and **pipes** transform the valid values.
5. **Cooldowns** count the call, and block it once the handler has run too often.
6. **`@Defer`, second step:** locks a component's message, now that the call will run.
7. **The handler** runs with what the stages produced.

**Exception filters** surround all of it: an error from any stage or the handler reaches them, and one no
filter handles goes to the built-in fallback, which answers the user.

**[Observers](/docs/4.1/observers)** frame the whole call: an observer's `onStart` is called as the call
begins, before `@Defer` and the guards, and its `onSettled` once the call has settled and been answered,
whatever the outcome, with how it ended and how long it took. The call waits for neither. They also hear
about an interaction no handler matches.

This handler records each stage as it runs:

::example{file="controllers/slash/stages.slash.controller.ts" region="stages"}

::example{file="controllers/slash/stages.slash.controller.spec.ts" region="spec"}

## Which handlers take which stages

- Validation and pipes apply to command, component and modal handlers, and to
  [message handlers with a pattern](/docs/4.1/message-commands), whose options, customId params, modal fields
  and pattern params they check.
- Cooldowns apply to those, and to every message handler.
- An autocomplete handler, which must answer within three seconds, runs its guards and filters but no
  interceptors.
- `@Defer` applies to command, component and modal handlers only.

## Where stages are declared

Guards, interceptors and filters apply at three levels, which run in this order: globally, from
`@MeoCord({ guards, interceptors, filters })`; on a controller, for every handler it declares or inherits; and
on a method. Cooldowns apply on a controller or a method.

A stage sees what it is running for through `ExecutionContext`, whose `getType()` is `'interaction'`,
`'autocomplete'`, `'message'`, `'reaction'` or `'event'`. A guard or interceptor declared with `types`, such as
`@Guard({ types: ['interaction'] })`, runs only for those, and a subclass inherits its `types` unless it
declares its own.

## Dispatch, tests and direct calls

The stages run when MeoCord dispatches a handler, and when a test runs one with `invoke`, as above. A
controller method called directly runs only its own guards.
