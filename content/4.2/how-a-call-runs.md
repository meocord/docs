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

::playground{file="controllers/slash/stages.slash.controller.ts" region="stages" dispatch="/stages text:' hello '"}

The test runs it the way the bot does and reads the order back:

::example{file="controllers/slash/stages.slash.controller.spec.ts" region="spec"}

The guard runs after `@Defer` has [acknowledged](guide:glossary#acknowledgement) the interaction, the interceptor wraps
the pipe and the handler, and the handler runs last.

## How it works

A call runs these stages, top to bottom. Each links to the page that teaches it, and a stage drawn around others
wraps them. Pick a kind of handler to see only the stages it runs:

::figure{name="pipeline"}

Each stage sits where it does for a reason:

1. **`@Defer` acknowledges first**, so slow stages never miss Discord's three seconds.
2. **Parse** reads a [message command](guide:message-commands)'s words into typed params, with no request to Discord.
   It comes before the guards so they can read the params. A word of the wrong type ends the call with the command's
   usage, which observers see as `'invalid'`.
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

A controller's stages also apply to every class that extends it, and a base's wrap what extends it, as global stages
wrap controllers. Guards and interceptors run the top base class's first, then each subclass's in turn, then the
method's; filters are tried the other way round, the method's first, then the subclass's, then each base's, so a
subclass's own filter comes before a catch-all on its base. Class cooldowns count from the base class down.
`@Controller({ inheritStages: false })` keeps the handlers a subclass declares to its own stages; the ones it inherits
keep their base's.

MeoCord resolves this chain once per handler, so dispatch pays nothing for it.
[`inspectHandler`](api:testing/inspectHandler) lists what a handler ends up with, in the order it runs.

## A subclass's routes

A subclass answers every route its bases declare, for the handlers it inherits. One it re-decorates on the same route
takes its own options there. One it re-decorates on another route answers that route as well as the inherited one,
and the bot names each such handler in a warning as it starts. Give the subclass
`@Controller({ inheritedRoutes: 'replace' })`, and a handler it re-decorates answers only the routes it declares
for it: the inherited ones are dropped, of every kind, from commands and component patterns to message patterns,
reactions and autocompletes. A slash or context menu command that only they answered is not registered. A method the
subclass overrides without decorators keeps every route it inherits either way.

[`inspectHandler`](api:testing/inspectHandler)'s `inheritedRoutes` lists the routes a handler answers because a base
declares them, so a test can pin what a subclass still answers.

## The call's context

Every stage can read the call through [`ExecutionContext`](api:utilities/ExecutionContext): the interaction or message,
the controller and handler, the handler's params and the [metadata](guide:glossary#metadata) on them. A guard injects it
through its constructor; an interceptor, a filter, a pipe and an observer receive it as an argument.

`getType()` says what is being handled: `'interaction'`, `'autocomplete'`, `'message'`, `'reaction'` or `'event'`.
A guard, interceptor or observer declared with `types` runs only for those.

`getHandlerParams()` and `getArgs()` follow the stages. A guard sees the params raw; an interceptor sees them raw
before `next.handle()` and validated and piped after it; a filter sees them as they stood when the error was thrown.

## Gotchas

- **A direct call runs only the guards.** Calling a controller method yourself runs its guards, and no interceptors,
  validation, pipes, cooldowns or filters. Run it with the [testing module](guide:testing) to get every stage.
- **A global stage runs for events too.** A global guard that reads `interaction.user.id` throws on a `messageCreate`
  handler; declare `types: ['interaction']`.
- **`@Defer` on a message, reaction, event or autocomplete handler stops the bot at startup,** since there is nothing to
  acknowledge.

## Next steps

- [Guards](guide:guards): decide who may run a command, before anything else happens.
- [Validation and pipes](guide:validation): give the handler typed, valid input.
- [Observers](guide:observers): record every call and how it ended.
