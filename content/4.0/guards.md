---
id: guards
title: 'Guards'
order: 11
source: readme@4.0.0
---

Guards run before the handler method. Each guard implements `canActivate` — return `true` to allow, `false` to block.

```typescript
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'
import { type ChatInputCommandInteraction } from 'discord.js'
import { RedisService } from '@src/services/redis.service.js'

@Guard()
export class RateLimiterGuard implements GuardInterface {
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

// Per-class (applies to every command in the controller)
@Controller()
@UseGuard(MetricsGuard, DefaultGuard)
export class ProfileController { ... }
```

---
