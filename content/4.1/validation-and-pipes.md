---
id: validation-and-pipes
title: "Validation and Pipes"
order: 16
source: readme@4.1.0-beta.0
---

`@Validate` checks a handler's input before it runs, so the handler receives typed, valid values or does not run at all. It takes a schema from any library that implements [Standard Schema](https://standardschema.dev) — zod, valibot, arktype and others — so MeoCord bundles no validator and you keep the one you know.

```typescript
import { z } from 'zod'
import { Command, Validate } from 'meocord/decorator'

@Command('remind', CommandType.SLASH)
@Validate(z.object({ minutes: z.number().int().min(1).max(1440), note: z.string().max(200).default('') }))
async remind(interaction: ChatInputCommandInteraction, { minutes, note }: { minutes: number; note: string }) {}
```

The input is one object: a chat command's options, or a component's customId params together with a modal's fields — what the handler's second argument holds anyway. The handler receives the schema's output, so defaults and coercions apply, and its second parameter is type-checked against it: `{ minutes: string }` above fails to compile.

Invalid input stops the call with a `ValidationError` (from `meocord/common`) whose `issues` list each problem and where it is. The user gets a private reply with them. Schema libraries write their messages in English; an exception filter that maps issues to your own words is the place to localise them.

Validation runs after guards and inside interceptors, so a timing or logging interceptor sees a failure as the handler's error. It applies to command, component and modal handlers only; the bot refuses to start with `@Validate` or `@UsePipe` on a message, reaction, autocomplete or event handler. A handler takes one `@Validate`; a second throws, so combine the schemas into one.

### Pipes

A pipe turns one validated value into what the handler works with — an id into an account, say. Give pipes to `@Validate`, and the handler's parameter is typed with what they produce:

```typescript
@Pipe()
export class AccountPipe implements PipeInterface<string, Account> {
  constructor(private readonly accounts: AccountService) {}

  async transform(uid: string): Promise<Account> {
    return this.accounts.find(uid)
  }
}

@Command('profile/{uid}', CommandType.BUTTON)
@Validate(z.object({ uid: z.string().regex(/^\d{9,10}$/) }), { pipes: { uid: AccountPipe } })
async profile(interaction: ButtonInteraction, { uid }: { uid: Account }) {}
```

`pipes` maps a key to one pipe or to several, applied in order. `@UsePipe(key, ...pipes)` does the same as a decorator of its own, with or without `@Validate`, after `@Validate`'s pipes. `@Validate` cannot see a separate `@UsePipe`, so mark the value that pipe produces `Piped<T>` (from `meocord/interface`) — inside the handler it is exactly `T`:

```typescript
@Command('profile/{uid}', CommandType.BUTTON)
@Validate(z.object({ uid: z.string() }))
@UsePipe('uid', AccountPipe)
async profile(interaction: ButtonInteraction, { uid }: { uid: Piped<Account> }) {}
```

Both forms are checked: a pipe whose output does not fit the parameter fails to compile, and an unmarked key a separate pipe changes is reported as a mismatch with `@Validate`.

A pipe is resolved from the container like a service, so it can inject one, and one instance serves every call. Per-use values go through `{ provide, params }` and `context.getParams()`, the second argument of `transform`. A pipe that throws stops the call, and the error reaches the filters. Generate one with `npx meocord g pi <name>`.

---
