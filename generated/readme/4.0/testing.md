---
id: testing
title: 'Testing'
order: 13
source: readme@4.0.0
---

MeoCord ships a `meocord/testing` entry point with utilities for testing controllers in isolation — no real Discord connection required. The framework repo runs tests with [Vitest](https://vitest.dev/); the mocks themselves are **framework-agnostic** and work with Vitest or Jest assertions (see below).

### Running tests

From the MeoCord repo root:

```shell
bun run test              # run once
bun run test:watch        # watch mode
bun run test:coverage     # coverage report
bun run test:typecheck    # tsc -p tsconfig.test.json
bun run lint              # eslint --fix + tsc
```

Generated apps come with Vitest set up — `vitest.config.ts` with SWC for decorator metadata, and `test`, `test:watch` and `test:coverage` scripts — plus a spec beside every generated component. In an older project, add Vitest (or keep Jest) with the same SWC setup; `meocord/testing` works with either.

### `MeoCordTestingModule`

Builds an isolated DI container from your controllers and providers.

```typescript
import { MeoCordTestingModule } from 'meocord/testing'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller.js'
import { GreetingService } from '@src/services/greeting.service.js'

const module = MeoCordTestingModule.create({
  controllers: [GreetingSlashController],
  providers: [{ provide: GreetingService, useValue: mockGreetingService }],
}).compile()

const controller = module.get(GreetingSlashController)
```

<details>
<summary><b><code>createMockInteraction</code></b></summary>

Creates a smart mock instance of any discord.js class. The full prototype chain is preserved so `instanceof` checks pass at every level.

**Type guards run real logic** — `isButton()`, `isRepliable()`, `isChatInputCommand()`, etc. are backed by the actual discord.js prototype methods. The right fields (`type`, `componentType`, `commandType`) are set based on the class you pass in, so no manual `.mockReturnValue(true)` setup is needed. All type guard methods are still mock functions and can be overridden per test.

**Reply state machine** — for repliable interactions, `replied` and `deferred` start as `false`. Calling `reply()` or `deferReply()` twice throws, just like a real interaction. `followUp()`, `editReply()`, and `deleteReply()` throw if called before any reply. The ephemeral flag is tracked on `interaction.ephemeral`, read from `flags` only — the deprecated `ephemeral: true` reply option is not honoured. All reply methods are still mock functions so call assertions work normally.

Autocomplete interactions are not repliable but get the equivalent for their own single-shot response: `responded` starts as `false`, `respond()` sets it, and a second call throws.

Guards discord.js has deprecated are deliberately left unwired — `isSelectMenu()` returns `undefined` rather than reproducing behaviour the library is removing. Use `isStringSelectMenu()`.

> **Framework-agnostic** — the mocks returned here are plain mock functions that stamp `_isMockFunction` and expose `.mock.calls`, the exact contract both `jest` and `vitest` check. Use them with either framework's `expect(...).toHaveBeenCalledWith(...)` / `toHaveBeenCalledTimes(...)` — no jest or vitest import is required to produce them. For typed stubs in your own code, import `MockedFunction`, `createMockFn`, and `DeepMocked` from `meocord/testing`.

```typescript
import { createMockInteraction } from 'meocord/testing'
import { ChatInputCommandInteraction, ButtonInteraction, BaseInteraction } from 'discord.js'

const interaction = createMockInteraction(ChatInputCommandInteraction)

// instanceof works at every level
expect(interaction).toBeInstanceOf(ChatInputCommandInteraction) // true
expect(interaction).toBeInstanceOf(BaseInteraction) // true

// type guards work — no manual setup needed
interaction.isChatInputCommand() // → true
interaction.isRepliable() // → true
interaction.isButton() // → false

// reply state machine
interaction.replied // → false
await interaction.reply({ content: 'hi' })
interaction.replied // → true
await interaction.reply({ content: 'again' }) // → throws (already replied)

// still a mock fn — call assertions work normally
expect(interaction.reply).toHaveBeenCalledWith({ content: 'hi' })

// direct property writes work normally
interaction.guildId = 'guild-123'
```

Works for any discord.js class — interactions, `Message`, `MessageReaction`, and anything else. No per-type maintenance.

**Assignable to the real class** — the returned mock can be passed straight to code that expects the discord.js type. No `as unknown as ButtonInteraction` at the call site.

```typescript
const interaction = createMockInteraction(ButtonInteraction)

await controller.handleButton(interaction) // takes a real ButtonInteraction
```

**Property overrides at construction** — pass a second argument to set properties as the mock is built. This is required for anything discord.js declares `readonly` (`ModalSubmitInteraction#customId` and `#fields`, `MessageComponentInteraction#message`, `client`, `guildId` on some classes), since those cannot be assigned afterwards. It is also how you set a property backed by a getter-only prototype accessor, such as `targetUser` or `targetMessage` on a context menu.

```typescript
import { createMockInteraction, createMockUser } from 'meocord/testing'
import { ModalSubmitInteraction, UserContextMenuCommandInteraction } from 'discord.js'

const modal = createMockInteraction(ModalSubmitInteraction, {
  customId: 'wish-import-800000000',
  fields: { getTextInputValue: () => '{"pulls":[]}' } as unknown as ModalSubmitInteraction['fields'],
})

const contextMenu = createMockInteraction(UserContextMenuCommandInteraction, {
  commandName: 'profile',
  targetUser: createMockUser(),
})
```

The override record is typed as `MockProps<T>`, exported from `meocord/testing`. Every key is optional, and a misspelled property name is a compile error.

</details>

<details>
<summary><b><code>createChatInputOptions</code></b></summary>

Builds a typed options resolver from a plain record. Type routing mirrors the real `CommandInteractionOptionResolver`: wrong-type access returns `null`, `required=true` throws if the option is absent.

```typescript
import { createMockInteraction, createChatInputOptions } from 'meocord/testing'
import { ChatInputCommandInteraction } from 'discord.js'

const interaction = createMockInteraction(ChatInputCommandInteraction)
interaction.options = createChatInputOptions({
  subcommandGroup: 'admin',
  subcommand: 'ban',
  user: { id: '123456789' },
  reason: 'spam',
  duration: 7,
})

interaction.options.getSubcommandGroup() // → 'admin'
interaction.options.getSubcommand(true) // → 'ban'
interaction.options.getUser('user') // → { id: '123456789' }
interaction.options.getString('reason') // → 'spam'
interaction.options.getNumber('duration') // → 7
interaction.options.getString('duration') // → null (wrong type)
interaction.options.getNumber('x', true) // → throws (absent + required)
```

`data` is materialised too, nested under the subcommand path exactly as Discord sends it. That is what the framework reads to build a handler's second argument, so a params assertion sees the same record production would:

```typescript
interaction.options.data
// → [{ name: 'admin', type: SubcommandGroup, options: [{ name: 'ban', type: Subcommand, options: [...] }] }]
```

Entity options are set on both `value` (the snowflake) and their own resolved field, so a handler that reads only one of the two is caught rather than silently passing. Pass a `createMockInteraction(User, …)`, `Role`, channel or `Attachment` mock and it lands on `user`/`role`/`channel`/`attachment`.

For autocomplete, `focused` names the option being typed:

```typescript
const interaction = createMockInteraction(AutocompleteInteraction)
interaction.options = createChatInputOptions({ focused: 'query', query: 'ad' })

interaction.options.getFocused(true) // → { name: 'query', value: 'ad', focused: true, … }
interaction.options.getFocused() // → 'ad'
```

Omit it and `getFocused` throws, the same as the real resolver does when no option is focused.

`subcommandGroup`, `subcommand` and `focused` are reserved keys — an option of your own cannot use those names.

All methods are mock functions — override any per test with `.mockReturnValue()`.

</details>

<details>
<summary><b><code>createMockUser</code> / <code>createMockClient</code> / <code>createMockGuild</code> / <code>createMockChannel</code></b></summary>

Convenience wrappers for common discord.js classes. All methods are auto-stubbed as mock functions. Nested managers (`client.users`, `guild.members`, etc.) are independent nested stubs.

```typescript
import { createMockFn, createMockUser, createMockClient, createMockGuild, createMockChannel } from 'meocord/testing'
import { TextChannel } from 'discord.js'

const user = createMockUser()
const client = createMockClient()
const guild = createMockGuild()
const channel = createMockChannel(TextChannel)

// override nested manager methods per test (createMockFn works with vitest and jest matchers)
;(client.users as any).fetch = createMockFn(() => Promise.resolve(user))
await (client.users as any).fetch('user-123')
expect((client.users as any).fetch).toHaveBeenCalledWith('user-123')
```

</details>

<details>
<summary><b><code>createMockMessage</code></b></summary>

Creates a smart mock `Message`. Tracks a `deleted` boolean — `delete()`, `edit()`, `reply()`, `react()`, `pin()`, and `unpin()` throw if the message has already been deleted. `edit()` and `reply()` resolve to a new mock `Message` instance. All methods are mock functions.

```typescript
import { createMockMessage } from 'meocord/testing'

const msg = createMockMessage()

msg.deleted // → false
await msg.delete()
msg.deleted // → true
await msg.delete() // → throws (already deleted)
await msg.edit({ content: 'x' }) // → throws (already deleted)

// edit() and reply() resolve to a new Message mock
const edited = await createMockMessage().edit({ content: 'updated' })
edited.delete // → a mock fn

// still a mock fn — assertions work
expect(msg.delete).toHaveBeenCalledTimes(1)
```

</details>

<details>
<summary><b><code>resolveRoute</code> / <code>findRouteConflicts</code></b></summary>

Tests which handler a component's customId reaches — the same answer dispatch gives, across every
controller your app registers, most specific pattern first. They read decorator metadata only, so
they need no Discord client, config or container. They check routing alone: guards are not run, and
whether a controller's dependencies are bound is for `MeoCordTestingModule` to test.

```typescript
import { findRouteConflicts, resolveRoute } from 'meocord/testing'
import { CommandType } from 'meocord/enum'
import App from '@src/app'
import { ProfileController } from '@src/controllers/button/profile.button.controller'

it('routes the profile button to its handler', () => {
  const route = resolveRoute(App, { type: CommandType.BUTTON, customId: 'profile/111/8000' })

  // The method itself rather than its name, so renaming it in your editor updates the test too.
  expect(route?.handler).toBe(ProfileController.prototype.showProfile)
  expect(route?.params).toEqual({ ownerId: '111', uid: '8000' })
})

// Patterns that can match the same customId, as a failing test rather than a startup warning.
it('has no overlapping component patterns', () => {
  expect(findRouteConflicts(App)).toEqual([])
})
```

`resolveRoute` returns the `controller`, the `handler` method and its name as `method`, and the
`params` the pattern captured — or `undefined` when no route handles the customId.

</details>

<details>
<summary><b><code>createMock</code></b></summary>

Mocks any type without a runtime class — use it for the services a controller depends on. `createMockInteraction` needs a class to build a prototype chain from, which is what makes `instanceof` and the real type guards work; a service double needs none of that, and an injected dependency may be an interface that does not exist at runtime at all.

Every property is a mock fn, created on first access, so a double only declares what the test cares about. The result is assignable to `T`, so it goes straight into `useValue` with no cast — which matters because a class holding a `private` member (a logger, say) can never be satisfied by an object literal.

```typescript
import { createMock, MeoCordTestingModule } from 'meocord/testing'
import { GreetingService } from '@src/services/greeting.service.js'

const greetingService = createMock<GreetingService>()
greetingService.buildGreeting.mockResolvedValue('Hello, Alice!')

const module = MeoCordTestingModule.create({
  controllers: [GreetingSlashController],
  providers: [{ provide: GreetingService, useValue: greetingService }],
}).compile()

expect(greetingService.buildGreeting).toHaveBeenCalledWith('Alice')
```

Nested access works without declaring the shape first — `cache.store.flush()` is a mock fn on a mock fn. Properties passed as `createMock<T>({ ... })` are used exactly as given rather than wrapped, so call assertions do not apply to those.

</details>

<details>
<summary><b><code>overrideGuard</code></b></summary>

Replaces a guard class in the DI container with a stub. No guard dependencies need to be provided.

```typescript
const module = MeoCordTestingModule.create({
  controllers: [GreetingSlashController],
  providers: [{ provide: GreetingService, useValue: mockGreetingService }],
})
  .overrideGuard(MetricsGuard)
  .useValue({ canActivate: () => true })
  .overrideGuard(RateLimitGuard)
  .useValue({ canActivate: () => true })
  .compile()
```

`canActivate: () => true` allows the method to run. `() => false` blocks it. Multiple guards chain fluently.

</details>

<details>
<summary><b><code>overrideProvider</code></b></summary>

Replaces a provider already registered on the module. The value is typed as `Partial<T>`, so a double only has to cover the methods the test exercises — a class with a private member could never be satisfied by a full object literal anyway. A misspelled method name is still a compile error.

```typescript
const module = MeoCordTestingModule.create({
  controllers: [GreetingSlashController],
  providers: [{ provide: GreetingService, useValue: realGreetingService }],
})
  .overrideProvider(GreetingService)
  .useValue({ buildGreeting: createMockFn() })
  .compile()
```

</details>

<details>
<summary><b>Full example</b></summary>

```typescript
import {
  MeoCordTestingModule,
  createMockFn,
  createMockInteraction,
  createChatInputOptions,
  type MockedFunction,
} from 'meocord/testing'
import { ChatInputCommandInteraction } from 'discord.js'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller.js'
import { GreetingService } from '@src/services/greeting.service.js'
import { RateLimitGuard } from '@src/guards/rate-limit.guard.js'

describe('GreetingSlashController', () => {
  let controller: GreetingSlashController
  let greetingService: { buildGreeting: MockedFunction<GreetingService['buildGreeting']> }

  beforeEach(() => {
    greetingService = { buildGreeting: createMockFn() }

    const module = MeoCordTestingModule.create({
      controllers: [GreetingSlashController],
      providers: [{ provide: GreetingService, useValue: greetingService }],
    })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get(GreetingSlashController)
  })

  it('replies with a greeting for the provided name', async () => {
    greetingService.buildGreeting.mockResolvedValue('Hello, Alice!')

    const interaction = createMockInteraction(ChatInputCommandInteraction)
    interaction.options = createChatInputOptions({ name: 'Alice' })

    await controller.greet(interaction)

    expect(greetingService.buildGreeting).toHaveBeenCalledWith('Alice')
    expect(interaction.reply).toHaveBeenCalledWith({ content: 'Hello, Alice!' })
  })
})
```

</details>

---
