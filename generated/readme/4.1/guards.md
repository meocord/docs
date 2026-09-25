---
id: guards
title: 'Guards'
order: 13
source: readme@4.1.0-beta.0
---

Guards run first, before anything else touches the handler. Each guard implements `canActivate` — return `true` to allow, `false` to block.

A new guard instance is created for every call, so keep state that must outlast one call — such as rate-limit counts — outside the guard: at module level, or in a service registered in `@MeoCord({ services })`, which makes it a singleton. Do not list the guard class itself there: one shared instance would take every call's `params`, and the bot warns at startup.

A guard runs for every kind of handler it applies to — global guards from `@MeoCord({ guards })` included, which also run before [`@On` event handlers](/docs/4.1/gateway-events#gateway-events). To limit one, declare the context types it runs for: `@Guard({ types: ['interaction'] })` skips messages, reactions and events.

```typescript
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'
import { type ChatInputCommandInteraction } from 'discord.js'
import { RedisService } from '@src/services/redis.service.js'

@Guard()
export class RateLimiterGuard implements GuardInterface {
  // RedisService is listed in @MeoCord({ services }), so every guard instance shares one client
  constructor(private readonly redis: RedisService) {}

  // limit and window are injected via @UseGuard params
  limit = 5
  window = 60_000

  async canActivate(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const key = `ratelimit:${interaction.user.id}`
    const count = await this.redis.increment(key, this.window)
    return count <= this.limit
  }
}
```

Apply to a single method or an entire controller:

```typescript
// Per-method, with params
@Command('search', CommandType.SLASH)
@UseGuard({ provide: RateLimiterGuard, params: { limit: 5, window: 60_000 } })
async search(interaction: ChatInputCommandInteraction) { ... }

// Per-class (applies to every handler in the controller)
@Controller()
@UseGuard(MetricsGuard, DefaultGuard)
export class ProfileController { ... }
```

The rate limiter shows how a guard takes options. To limit how often a handler runs, [`@Cooldown`](/docs/4.1/cooldowns#cooldowns) does it without a guard of your own, and answers the caller with how long to wait.

A class-level `@UseGuard` also guards the handlers a controller inherits. For a subclass, its own class guards run first, then the base class's guards, then the method's. A base class's class guards do not wrap the handlers a subclass declares itself:

```typescript
@Controller()
@UseGuard(StaffGuard)
export class AdminController extends ModerationController { ... } // ModerationController's handlers run StaffGuard first
```

To guard every handler in the bot, list guards in `@MeoCord({ guards })`. They take the same forms as `@UseGuard` and run first, before the controller's and the method's guards:

```typescript
@MeoCord({
  controllers: [ProfileController, ModerationController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  guards: [BlocklistGuard, { provide: RateLimiterGuard, params: { limit: 20, window: 60_000 } }],
})
class App {}
```

Global guards run when a handler is dispatched, or run with [`invoke`](/docs/4.1/testing#running-a-handler-with-invoke). A controller method called directly runs only its own class and method guards.

### Passing options to a guard

Use params when a value configures one use of a guard, such as a limit or the channels a command is allowed in. `@UseGuard({ provide, params })` sets them as properties on the guard instance before `canActivate` runs, and a decorator of your own can wrap it. For facts about the handler itself that any guard can read, use [metadata](#reading-handler-metadata) instead. `params` is optional, so `{ provide: ChannelGuard }` works as the class alone. The same entry forms apply to interceptors, filters and pipes, and an entry that is neither a class nor `{ provide: Class, params? }` is refused when its decorator applies.

```typescript
import { Guard, UseGuard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'
import { type ChatInputCommandInteraction } from 'discord.js'

@Guard()
export class ChannelGuard implements GuardInterface {
  // Set per use with @UseGuard({ provide: ChannelGuard, params: { channelIds } })
  channelIds: string[] = []

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    return this.channelIds.length === 0 || this.channelIds.includes(interaction.channelId)
  }
}

export const OnlyInChannels = (...channelIds: string[]) => UseGuard({ provide: ChannelGuard, params: { channelIds } })
```

```typescript
@Command('trade', CommandType.SLASH)
@OnlyInChannels('123456789012345678')
async trade(interaction: ChatInputCommandInteraction) { ... }
```

### Reading handler metadata

`createMetadata` makes a typed decorator for handler metadata. Put it on a controller, a handler, or both; a guard reads it through `ExecutionContext`, which describes the handler being guarded. The handler's value wins over the controller's.

```typescript
import { type ChatInputCommandInteraction } from 'discord.js'
import { applyDecorators, createMetadata, ExecutionContext } from 'meocord/common'
import { Command, Guard, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type GuardInterface } from 'meocord/interface'

// Define the metadata decorator
export const Roles = createMetadata<string[]>('roles')

// Read it inside a guard
@Guard()
export class RolesGuard implements GuardInterface {
  constructor(private readonly context: ExecutionContext) {}

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    const required = this.context.get(Roles) ?? []
    if (!required.length) return true
    return interaction.inCachedGuild() && required.some(role => interaction.member.roles.cache.has(role))
  }
}

// Compose into a single decorator
export const RequireRoles = (...roles: string[]) => applyDecorators(Roles(roles), UseGuard(RolesGuard))

// Apply
@Command('ban', CommandType.SLASH)
@RequireRoles('admin', 'moderator')
async ban(interaction: ChatInputCommandInteraction) { ... }
```

Use params for configuring one guard (`{ provide, params }`, [above](#passing-options-to-a-guard)), and `createMetadata` for facts about a handler that any guard can read. `ExecutionContext` is injected only into guards: each call gets its own, so a controller or service, which is shared across calls, cannot inject it. The context also gives the handler's arguments (`getArgs()`, `getInteraction()`, `getMessage()`, `getReaction()`), what it is handling (`getType()`), the controller and method (`getController()`, `getHandlerName()`), and the guard's own params (`getParams()`). Values declared with `SetMetadata` are read with their key: `this.context.get<string[]>('roles')`.

In a unit test, build the context with `createExecutionContext` from `meocord/testing`:

```typescript
const interaction = createMockInteraction(ChatInputCommandInteraction)
const guard = new RolesGuard(createExecutionContext(ModerationController, 'ban', { args: [interaction] }))
expect(guard.canActivate(interaction)).toBe(false)
```

To test the guard together with the handler it protects, run the handler with [`invoke`](/docs/4.1/testing#running-a-handler-with-invoke).

### Guards on autocomplete, and denying with a reason

Class-level and global guards also run before `@Autocomplete` handlers. There the guard receives an `AutocompleteInteraction`, which has no `reply()`, and `ExecutionContext.getType()` is `'autocomplete'`. A guard must not try to answer it: return `false` to deny, and MeoCord closes the menu with an empty list.

Returning `false` denies silently. To tell the user why, throw `GuardDeniedError` from `meocord/common` with the message to show: it is answered only to the user who made the call, and an [exception filter](/docs/4.1/exception-filters#exception-filters) can catch it to answer differently.

```typescript
canActivate(interaction: ButtonInteraction, { ownerId }: { ownerId: string }): boolean {
  if (interaction.user.id !== ownerId) throw new GuardDeniedError('Only the owner can use this.')
  return true
}
```

---
