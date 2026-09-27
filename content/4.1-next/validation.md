---
id: validation
title: Validation and pipes
chapter: pipeline
order: 3
summary: Check a handler's input against a schema, and turn valid values into what it works with, before the handler runs.
learn:
  - Validate a handler's input with zod, valibot or any Standard Schema library
  - Turn a validated value into an object with a pipe
  - Type the handler's params from the schema and its pipes
requires: [how-a-call-runs, components]
api:
  [
    decorators/Validate,
    decorators/UsePipe,
    decorators/Pipe,
    types/PipeInterface,
    types/Piped,
    responses/ValidationError,
  ]
since: 4.1.0
formerly: [validation-and-pipes]
---

[`@Validate`](api:decorators/Validate) checks a handler's input before it runs, so the handler receives typed, valid
values or doesn't run at all. It takes a schema from any library that implements
[Standard Schema](https://standardschema.dev), such as zod, valibot or arktype, so MeoCord bundles no validator and you
keep the one you know.

A pipe then turns one valid value into what the handler works with: an account ID into the account, say.

## When to use it

Validate what Discord can't check for you: a number's range, a string's format, a customId param a user could have
tampered with, a modal field's length. The user is told exactly what's wrong.

Discord already checks a slash command option's type and its `setMinValue` or `setMaxLength`, so a builder is the first
place for those. A customId param's type, such as a number, can go in its pattern, `{count:int}`, as
[Components](guide:components) shows. Who may run the handler isn't input; that's a [guard](guide:guards).

## Example

::example{file="controllers/slash/remind.slash.controller.ts" region="validate"}

The schema's output is what the handler receives, so `note` defaults to `''` when the option is left out. The second
parameter is checked against that output when the code compiles. A `/remind` with `minutes: 0` doesn't run the
handler, and the user is told privately which value is wrong and why.

## How it works

Validation runs after the guards, inside the [interceptors](guide:interceptors), so an interceptor sees invalid input
as the handler's error. Pipes run right after it, then [cooldowns](guide:cooldowns) count the call. Input that fails
never uses up a cooldown.

The input is one object, the handler's second argument:

| Handler                      | Its input                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| Slash command                | its options                                                                             |
| Button                       | its customId params                                                                     |
| Select menu                  | its customId params, `values`, and the chosen `users`, `members`, `roles` or `channels` |
| Modal                        | its customId params and its fields                                                      |
| Message command with pattern | its pattern's params                                                                    |

Invalid input throws [`ValidationError`](api:responses/ValidationError), whose `issues` list each problem and where it
is. The built-in fallback answers it only to the caller: privately after an interaction, and after a message command
as a reply that's deleted like a usage reply. Schema libraries write their messages in English; an
[exception filter](guide:exception-filters) that maps the issues to your own words is where to translate them.

::example{file="controllers/slash/remind.slash.controller.spec.ts" region="spec"}

A handler takes one `@Validate`. To check several things, combine them in one schema.

## Pipes

A pipe is a class marked [`@Pipe()`](api:decorators/Pipe) that implements
[`PipeInterface`](api:types/PipeInterface). Its `transform` takes one value and returns another:

::example{file="pipes/account.pipe.ts" region="pipe"}

Give pipes to `@Validate` for the schema's keys, and the handler's parameter is typed with what they produce:

::example{file="controllers/button/account.button.controller.ts" region="pipes"}

The schema checks the uid's format first, so the pipe only ever sees a well-formed one. `pipes` maps a key to one pipe
or to several, applied in order, each receiving the previous one's result.

One instance of a pipe serves every call, so it can inject services, as `AccountPipe` does, and hold a cache. A pipe
that throws stops the call, and its error reaches the [exception filters](guide:exception-filters). To give one use of a
pipe its settings, pass `{ provide, params }`, read with `context.getParams()` from `transform`'s second argument.

## A pipe without a schema

[`@UsePipe(key, ...pipes)`](api:decorators/UsePipe) runs pipes on one value without a schema, or after `@Validate`'s
own pipes. `@Validate` can't see a separate `@UsePipe`, so mark the value that pipe produces
[`Piped<T>`](api:types/Piped) in the handler's params; inside the handler it's exactly `T`. A pipe whose output doesn't
fit the parameter fails to compile.

## Which handlers take them

`@Validate` and `@UsePipe` apply to command, component and modal handlers, and to message handlers with a pattern.
Autocomplete, reaction and event handlers, and a message handler for every message, have no params to check: the bot
refuses to start with either on them.

## Gotchas

- **Two `@Validate` on one handler throw** as the decorator applies. Combine the schemas.
- **A guard sees the raw input.** Validation runs after the guards, so a guard reading `getHandlerParams()` gets the
  values before the schema's defaults and coercions.
- **Mark a separate pipe's output `Piped<T>`.** Without it, the handler's params don't match the schema's output and
  the code doesn't compile.

## Next steps

- [Interceptors](guide:interceptors): see the input before and after validation.
- [Exception filters](guide:exception-filters): word `ValidationError`'s issues your own way, or in the user's
  language.
- [Cooldowns](guide:cooldowns): limit how often valid input can run the handler.
