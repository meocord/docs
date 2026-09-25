---
id: custom-decorators
title: 'Custom Decorators'
order: 18
source: readme@4.1.0-beta.0
---

MeoCord exports `applyDecorators` from `meocord/common` to combine decorators into one of your own, and `createMetadata` for a typed decorator that stores a value on a handler — see [Reading handler metadata](/docs/4.1/guards#reading-handler-metadata). `SetMetadata(key, value)` stores a value under a key of your choosing, read with `ExecutionContext.get(key)`; prefer `createMetadata`, whose values are typed and whose key cannot collide. `SetMetadata` refuses MeoCord's own keys, such as `'guards'`, where a value would replace what the framework stores.

### Composing guards into a reusable decorator

```typescript
import { applyDecorators } from 'meocord/common'
import { UseGuard } from 'meocord/decorator'
import { DefaultGuard, RateLimiterGuard } from '@src/guards/index.js'

export const Protected = (limit = 5) =>
  applyDecorators(UseGuard(DefaultGuard, { provide: RateLimiterGuard, params: { limit } }))
```

```typescript
@Command('profile', CommandType.SLASH)
@Protected(3)
async profile(interaction: ChatInputCommandInteraction) { ... }
```

The [guard options](/docs/4.1/guards#passing-options-to-a-guard) and [metadata](/docs/4.1/guards#reading-handler-metadata) examples under Guards compose the same way.

---
