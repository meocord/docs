---
id: validation-and-pipes
title: Validation and pipes
section: Handling a call
order: 34
since: 4.1.0
---

`@Validate` checks a handler's input before it runs, so the handler receives typed, valid values or does not
run at all. It takes a schema from any library that implements [Standard Schema](https://standardschema.dev),
such as zod, valibot or arktype, so MeoCord bundles no validator and you keep the one you know.

::example{file="controllers/slash/remind.slash.controller.ts" region="validate"}

The input is one object: a command's options, or a component's customId params together with a modal's
fields, which is what the handler's second argument holds anyway. The handler receives the schema's output,
so defaults and coercions apply.

Invalid input stops the call with a `ValidationError` from `meocord/common`, whose `issues` list each problem
and where it is. The user gets a private reply listing them. Schema libraries write their messages in
English; an exception filter that maps the issues to your own words is where to localise them.

::example{file="controllers/slash/remind.slash.controller.spec.ts" region="spec"}

Validation runs after guards and inside interceptors, so a logging interceptor sees a failure as the
handler's error. It applies to command, component and modal handlers only: the bot refuses to start with
`@Validate` or `@UsePipe` on a message, reaction, autocomplete or event handler. A handler takes one
`@Validate`; combine the schemas into one.

## Pipes

A pipe turns one validated value into what the handler works with, an id into an account, say. Mark a class
`@Pipe()` and implement `PipeInterface`:

::example{file="pipes/account.pipe.ts" region="pipe"}

Give pipes to `@Validate`, and the handler's parameter is typed with what they produce:

::example{file="controllers/button/account.button.controller.ts" region="pipes"}

`pipes` maps a key to one pipe or to several, applied in order. `@UsePipe(key, ...pipes)` does the same as a
decorator of its own, after `@Validate`'s pipes. `@Validate` cannot see a separate `@UsePipe`, so mark the
value that pipe produces `Piped<T>`, from `meocord/interface`; inside the handler it is exactly `T`. A pipe
whose output does not fit the parameter fails to compile.

A pipe that throws stops the call, and its error reaches the filters. Options for one use go through
`{ provide, params }`, read with `context.getParams()` from `transform`'s second argument. Generate a pipe with
`npx meocord g pi <name>`.
