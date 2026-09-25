---
id: cooldowns
title: 'Cooldowns'
order: 17
source: readme@4.1.0-beta.0
---

`@Cooldown` limits how often a handler runs: at most `uses` calls within `seconds`, counted per user by default. The window slides, so each use comes back `seconds` after it was spent. Stack several for layered limits:

```typescript
import { Cooldown } from 'meocord/decorator'

@Command('daily', CommandType.SLASH)
@Cooldown({ seconds: 3 }) // one call every 3 seconds
@Cooldown({ uses: 5, seconds: 60 }) // and at most 5 a minute
async daily(interaction: ChatInputCommandInteraction) {}
```

Stacked cooldowns are counted in the order they read, a controller's first, and a call blocked by one has already spent those above it. Put the short one first, as here: a call made 1 second after the last is refused by the 3-second cooldown before it reaches the per-minute one. Written the other way round, each such call would spend one of the 5 before being refused.

| Option    | Default  | Description                                                                                                                             |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `seconds` | —        | The window's length.                                                                                                                    |
| `uses`    | `1`      | Calls allowed within the window.                                                                                                        |
| `per`     | `'user'` | Whose calls count together: `'user'`, `'guild'`, `'channel'` or `'global'`. Outside a server, `'guild'` and `'channel'` count per user. |
| `bypass`  | —        | `(context) => boolean`: exempts a call without counting it, such as one from an owner.                                                  |

A blocked call throws `CooldownError` (from `meocord/common`, with `retryAfterMs` and `per`), which the built-in fallback answers only to the caller: "Slow down: try again in 12s." `cooldownMessage(retryAfterMs)` builds that text; an [exception filter](/docs/4.1/exception-filters#exception-filters) catching `CooldownError` can say it another way, or in the user's language.

The cooldown is the [last stage](/docs/4.1/how-a-handler-runs#how-a-handler-runs) before the handler: guards, validation and pipes have let the call through, so a denied call or bad input spends nothing. It applies to interaction and message handlers. On a controller, `@Cooldown` applies to each of those handlers separately and skips the controller's autocomplete, reaction and event handlers; on one of those handlers itself, the bot refuses to start.

Cooldowns are counted under the controller's class name, so the bot refuses to start when two classes share a name and either has a cooldown; rename one of them.

For a reusable exemption, compose it: `const Limited = (seconds: number) => applyDecorators(Cooldown({ seconds, bypass: isOwner }))`.

### Where calls are counted

By default in this process's memory: one count per bot, which drops keys whose calls have all expired. With [process sharding](/docs/4.1/deployment#sharding), each shard counts on its own, so `'user'` and `'global'` cooldowns allow more than they say — the bot warns at startup. `'guild'` and `'channel'` stay exact, since a server lives on one shard.

To share one count, extend `CooldownStore` and pass it to `@MeoCord({ cooldownStore })`. It is resolved like a service, so it can inject its client, and its `consume` must check and record a call in one step, so two calls at the limit cannot both pass:

```typescript
import { CooldownStore, type CooldownLimit, type CooldownVerdict } from 'meocord/common'
import { RedisService } from '@src/services/redis.service.js'

@Service()
export class RedisCooldownStore extends CooldownStore {
  constructor(private readonly redis: RedisService) {
    super()
  }

  consume(key: string, { uses, windowMs }: CooldownLimit): Promise<CooldownVerdict> {
    return this.redis.slidingWindow(key, uses, windowMs) // a sorted set trimmed and counted in one Lua script
  }
}

@MeoCord({ controllers: [...], clientOptions: {...}, cooldownStore: RedisCooldownStore })
export default class App {}
```

In tests, each `MeoCordTestingModule` counts in a fresh in-memory store; provide `{ provide: CooldownStore, useValue }` to use another. `inspectHandler(Controller, 'method').cooldowns` lists a handler's cooldowns with their defaults.

---
