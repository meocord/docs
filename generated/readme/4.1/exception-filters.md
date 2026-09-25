---
id: exception-filters
title: 'Exception filters'
order: 15
source: readme@4.1.0-beta.0
---

An exception filter handles errors a handler, its interceptors or its guards throw, and decides what the user is told. `@Catch` names the error types it handles, matched with `instanceof`; with no types it handles everything.

```typescript
import { Catch, Controller, UseFilter } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'
import { type ExecutionContext } from 'meocord/common'
import { MessageFlags } from 'discord.js'

export class RateLimitedError extends Error {
  constructor(readonly retryAfter: number) {
    super(`Rate limited for ${retryAfter}s`)
  }
}

@Catch(RateLimitedError)
export class RateLimitedFilter implements ExceptionFilter<RateLimitedError> {
  async catch(error: RateLimitedError, context: ExecutionContext) {
    const interaction = context.getInteraction()
    if (!interaction?.isRepliable()) return
    const answer = { content: `Slow down: try again in ${error.retryAfter}s.`, flags: MessageFlags.Ephemeral } as const
    if (interaction.replied || interaction.deferred) await interaction.followUp(answer)
    else await interaction.reply(answer)
  }
}

@Controller()
@UseFilter(RateLimitedFilter) // every handler in the controller; or on one method
export class ProfileController { ... }
```

Apply filters with `@UseFilter` on a method or a controller, or to every handler with `@MeoCord({ filters })`. The filter closest to the handler wins: the method's filters are tried first, then the controller's, then global ones; within one level, the first whose `@Catch` matches, in the order listed. For an inherited handler, the class that declares it comes before the subclass. A filter that throws is logged, and the built-in fallback answers the original error.

Errors outside any handler reach global filters too. An interaction no handler matches raises `CommandNotFoundError` from `meocord/common`; there, `context.getController()` and `getHandler()` are `undefined`.

One instance of a filter serves every call, as with interceptors, so it cannot inject `ExecutionContext`, and `{ provide, params }` is read with `context.getParams()`.

### The built-in fallback

An error no filter handles goes to the built-in fallback. It logs the error, then answers through [`respond(interaction).error()`](/docs/4.1/interaction-responses#interaction-responses) if the interaction can still take an answer, privately and in the error style of the app's [presenter](/docs/4.1/interaction-responses#presenters):

| The interaction                                                              | The fallback                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Not answered yet                                                             | replies                                                 |
| A command, or a modal not submitted from a message, whose reply was deferred | edits the deferred reply into the error                 |
| The same, already replied to                                                 | follows up                                              |
| A button, select menu or modal from a public message, deferred or answered   | follows up; it never edits the message the user clicked |
| The same, from a private (ephemeral) message                                 | adds the error to that message                          |
| Autocomplete                                                                 | closes the menu with an empty list                      |
| Expired (Discord error 10062)                                                | logs only                                               |

It says "An error occurred while executing the command.", "Command not found!" for `CommandNotFoundError`, a `GuardDeniedError`'s own message, a `CooldownError`'s wait time, and a `ValidationError`'s list of issues — the last three kept private even on a deferred public command, by deleting the deferred reply and following up. Errors from message, reaction and event handlers are only logged, and the next handler still runs; a message blocked by a cooldown is ignored without an error log. The fallback never throws.

Filters apply when a handler is dispatched, or run with [`invoke`](/docs/4.1/testing#running-a-handler-with-invoke); a controller method called directly throws as it would without them. Under `invoke` the fallback does not run: an error no filter handles rejects, so tests see it.

Generate a filter with `npx meocord g f <name>`.

---
