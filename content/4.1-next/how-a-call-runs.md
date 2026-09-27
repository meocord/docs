---
id: how-a-call-runs
title: How a call runs
chapter: pipeline
order: 1
summary: The stages every handler call passes through, in the order they run, and why each one sits where it does.
learn:
  - Name the stages of a call and the order they run in
  - Tell which stages apply to which kinds of handler
  - Declare a stage globally, on a controller or on one handler
requires: [slash-commands, message-commands]
api: [utilities/ExecutionContext, types/ExecutionContextType, testing/inspectHandler]
since: 4.1.0
formerly: [how-a-handler-runs]
---

Every handler MeoCord runs, whether a command, a component, an autocomplete, a message, a reaction or a gateway event,
goes through the same stages in the same order. Each stage has one job, and its place in the order is what makes that
job cheap and safe: a denied call fetches nothing, and bad input never uses up a cooldown.

This page is the map. The pages after it take one stage each.

## When to use it

Read this before you write a stage of your own, to pick the one that fits:

| You want to                                               | Use                                            |
| --------------------------------------------------------- | ---------------------------------------------- |
| Decide whether a call may run at all                      | a [guard](guide:guards)                        |
| Check or convert the handler's input                      | [validation and pipes](guide:validation)       |
| Act before and after the handler, such as timing it       | an [interceptor](guide:interceptors)           |
| Limit how often a handler runs                            | a [cooldown](guide:cooldowns)                  |
| Answer an error your own way                              | an [exception filter](guide:exception-filters) |
| Record every call and how it ended, for metrics or audits | an [observer](guide:observers)                 |

## Example

This slash command has a guard, an interceptor and a pipe, and each of them records when it runs:

::example{file="controllers/slash/stages.slash.controller.ts" region="stages"}

The test runs it the way the bot does and reads the order back:

::example{file="controllers/slash/stages.slash.controller.spec.ts" region="spec"}

The guard runs after `@Defer` has acknowledged the interaction, the interceptor wraps the pipe and the handler, and
the handler runs last.

## How it works

A call runs these stages, top to bottom:

```text
observers: onStart
exception filters, around everything below
  @Defer, first step: acknowledge the interaction
  parse: read a message command's words into its params
  guards: global, then the controller's, then the method's
  cooldown check: only before a message command's fetch
  fetch: the members, users, roles and channels a message names
  interceptors, around everything below
    validation
    pipes
    cooldowns: count the call
    @Defer, second step: lock the component's message
    the handler
  the built-in fallback, for an error no filter handled
observers: onSettled
```

Each stage sits where it does for a reason:

1. **`@Defer` acknowledges first**, so slow stages never miss Discord's three seconds.
2. **Parse** reads a [message command](guide:message-commands)'s words into typed params, with no request to Discord.
   It comes before the guards so they can read the params. A word of the wrong type ends the call with the command's
   usage.
3. **Guards** decide whether the handler runs at all. They come before anything that costs a request or counts a
   call, so a caller they refuse costs nothing.
4. **The cooldown check** runs only when a message command's params still need fetching. It checks the handler's
   cooldowns without counting the call, so a caller on cooldown costs no request.
5. **Fetch** gets from Discord what the message names and discord.js doesn't hold yet. Each ID goes out once, however
   many calls ask for it at the same time.
6. **Interceptors** wrap everything after them. They can act before and after the handler, skip it, or replace its
   error. Validation runs inside them, so an interceptor sees invalid input as the handler's error.
7. **Validation** checks the handler's input against a schema, and **pipes** turn the valid values into what the
   handler works with.
8. **Cooldowns** count the call last, so a denied call or bad input never uses one up.
9. **`@Defer` locks** a component's message only now, so a denied or invalid call never touches it.
10. **The handler** runs with what the stages produced.

**Exception filters** surround all of it. An error from any stage, or from the handler, reaches them, and one no
filter handles goes to the built-in fallback, which answers the user. The handler, its filters and the fallback all
answer through [`respond()`](guide:responses), so each sees where the others left the answer.

**Observers** frame the whole call. `onStart` hears about it before `@Defer` and the guards, and `onSettled` once it
has settled and been answered, with how it ended and how long it took. The call waits for neither.

## Which handlers take which stages

Not every stage applies to every handler:

- **Parse, the cooldown check and the fetch** apply only to message handlers with a pattern.
- **Validation and pipes** apply to command, component and modal handlers, and to message handlers with a pattern.
  The bot refuses to start with `@Validate` or `@UsePipe` on any other handler.
- **Cooldowns** apply to interaction and message handlers. `@Cooldown` on an autocomplete, reaction or event handler
  stops the bot at startup.
- **`@Defer`** applies to command, component and modal handlers only.
- **Autocomplete** runs its guards and filters, and no interceptors: it must answer within three seconds and has no
  reply to shape.
- **Guards, interceptors and filters** run for reaction and event handlers too. A global guard or interceptor that
  reads an interaction declares `types: ['interaction']`, so it skips the rest.

## Where stages are declared

Guards, interceptors and filters apply at three levels:

1. globally, in `@MeoCord({ guards, interceptors, filters })`;
2. on a controller, for every handler it declares or inherits;
3. on one handler method.

Guards and interceptors run in that order, global first. Filters are tried the other way round: the method's first,
then the controller's, then the global ones. Cooldowns go on a controller or a method.

A controller's stages also apply to every class that extends it. A handler runs its own class's guards and
interceptors first, then each base class's in turn, so a guard on a base controller guards every subclass. Filters are
tried, and cooldowns counted, the other way round, from the base class out.
`@Controller({ inheritStages: false })` keeps the handlers a subclass declares to its own stages; the ones it inherits
keep their base's.

MeoCord resolves this chain once per handler, so dispatch pays nothing for it.
[`inspectHandler`](api:testing/inspectHandler) lists what a handler ends up with, in the order it runs.

## The call's context

Every stage can read the call through [`ExecutionContext`](api:utilities/ExecutionContext): the interaction or
message, the controller and handler, the handler's params and the metadata on them. A guard injects it through its
constructor; an interceptor, a filter, a pipe and an observer receive it as an argument.

`getType()` says what is being handled: `'interaction'`, `'autocomplete'`, `'message'`, `'reaction'` or `'event'`.
A guard, interceptor or observer declared with `types` runs only for those.

`getHandlerParams()` and `getArgs()` follow the stages. A guard sees the params raw; an interceptor sees them raw
before `next.handle()` and validated and piped after it; a filter sees them as they stood when the error was thrown.

## Gotchas

- **A direct call runs only the guards.** Calling a controller method yourself runs its guards, and no interceptors,
  validation, pipes, cooldowns or filters. Run it with the [testing module](guide:testing) to get every stage.
- **A global stage runs for events too.** A global guard that reads `interaction.user` throws on a `messageCreate`
  handler; declare `types: ['interaction']`.
- **`@Defer` on a message or event handler stops the bot at startup,** since there is nothing to acknowledge.

## Next steps

- [Guards](guide:guards): decide who may run a command, before anything else happens.
- [Validation and pipes](guide:validation): give the handler typed, valid input.
- [Observers](guide:observers): record every call and how it ended.
