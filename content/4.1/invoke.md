---
id: invoke
title: Running a handler with invoke
section: Testing
order: 41
since: 4.1.0
---

`module.invoke(Controller, 'method', ...args)` runs a handler the way the bot does: `@Defer`, its guards, its
interceptors around validation, pipes and cooldowns, and the handler, all inside its exception filters. The
method name and arguments are type-checked against the handler.

Pass the interaction alone, and `invoke` builds the handler's params as dispatch does: a command's options,
or a component's `customId` params and a modal's fields. The interaction must be one dispatch could route to
the handler, a `customId` its pattern matches or the command it handles; one that could not rejects, naming
both, so a typo in a test does not pass silently. A message passed alone to a patterned `@MessageHandler` is
checked the same way, after the prefix of the module's `app`, and the handler gets the params its pattern
captures; see [Message commands](/docs/4.1/message-commands#testing).

## What it resolves to

`invoke` resolves to `{ ran }`. `ran` is `false` when a [guard](/docs/4.1/guards) stopped the call or an
[interceptor](/docs/4.1/interceptors) skipped the handler, and `error` is set when an
[exception filter](/docs/4.1/exception-filters) handled one. An error no filter handles rejects: the
built-in fallback, which would answer the user, does not run in tests, so the test sees the error.

`getResponse(interaction)` reports what `respond()` did: where the answer stands, whether anything visible was
sent, and each Discord call it made, with its payload. A guard that returns `false` stops the call without an
answer:

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="invoke"}

A guard that denies with a reason throws `GuardDeniedError`. The bot answers it privately; in a test `invoke`
rejects with it, and `getResponse` shows what `@Defer` sent before the guard ran:

::example{file="controllers/button/card.button.controller.spec.ts"}

## Global guards, interceptors and filters

Pass the app class as `app` to include the ones `@MeoCord` declares. Only those are read from it; the
controllers and providers are still listed:

::example{file="testing/greeting.module.spec.ts" region="app"}

`app` also brings the app's `i18n` translator and `presenter`, its message prefixes, and its
[observers](/docs/4.1/observers#testing), which `invoke` waits for before it resolves.

## inspectHandler

`inspectHandler(Controller, 'method')` lists the guards, interceptors, filters and cooldowns dispatch applies
to a handler, in order, and reads its metadata as `ExecutionContext` does, without running anything. With
`{ app }`, the global ones come first, as above, and `observers` lists the app's observers. For a message
handler, `pattern` is its pattern.

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="inspect"}

A guard can also be tested alone, built with `createExecutionContext(Controller, 'method', { args })` for the
metadata it reads:

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="unit"}

## Calling a method directly

A controller method called directly, `module.get(Controller).method(interaction)`, runs its own guards but no
interceptors, validation or filters. Use `invoke` to test what dispatch runs around a handler.

To send a gateway event to the module's `@On` and `@Once` handlers, use `module.emit(event, ...args)`, which
resolves to how many handlers ran.
