---
id: how-a-handler-runs
title: 'How a handler runs'
order: 12
source: readme@4.1.0-beta.0
---

Every handler — a command, a component, an autocomplete, a message, a reaction or an [event](/docs/4.1/gateway-events#gateway-events) — runs through the same stages, in this order:

1. **[`@Defer`](/docs/4.1/interaction-responses#defer), step 1** acknowledges the interaction, so slow stages never miss Discord's three seconds.
2. **Guards** decide whether the handler runs at all.
3. **Interceptors** wrap everything after them: they can act before and after, skip the handler, or replace its error.
4. **Validation** checks the handler's input against a schema, and **pipes** transform the valid values.
5. **Cooldowns** count the call, and block it once the handler has run too often.
6. **`@Defer`, step 2** locks the component's message and shows the loading view, now that the call will run.
7. **The handler** runs with what the stages produced.

**Exception filters** surround all of it: an error from any stage or the handler reaches them, and one no filter handles goes to the built-in fallback. The handler, its interceptors and filters, and the fallback all answer through [`respond()`](/docs/4.1/interaction-responses#interaction-responses), so each sees where the others left the answer.

Validation and pipes apply to command, component and modal handlers, whose options, customId params and fields they check. Cooldowns apply to those and to message handlers. An autocomplete handler, which must answer within three seconds, runs its guards and filters but no interceptors. `@Defer` applies to command, component and modal handlers only.

Guards, interceptors and filters apply at three levels, which run in this order: globally, from `@MeoCord({ guards, interceptors, filters })`; on a controller, for every handler it declares or inherits; and on a method. Cooldowns apply on a controller or a method. A stage also sees what it is running for through `ExecutionContext`, whose `getType()` is `'interaction'`, `'autocomplete'`, `'message'`, `'reaction'` or `'event'`; a guard or interceptor declared with `types` runs only for those, and a subclass inherits them unless it declares its own. A `types` list that can match nothing — empty, or `['autocomplete']` on an interceptor, since interceptors skip autocomplete — throws when the class is decorated.

The stages run when MeoCord dispatches a handler, and when a test runs one with [`invoke`](/docs/4.1/testing#running-a-handler-with-invoke). A controller method called directly runs only its guards.

---
