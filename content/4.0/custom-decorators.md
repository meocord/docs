---
id: custom-decorators
title: "Custom Decorators"
order: 12
source: readme@4.0.0
---

MeoCord exports `applyDecorators` and `SetMetadata` from `meocord/common` for composing reusable decorators.

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

### Attaching metadata for guards to read

```typescript
// Define the metadata decorator
import { SetMetadata } from 'meocord/common'
export const Roles = (...roles: string[]) => SetMetadata('roles', roles)

// Read it inside a guard
@Guard()
export class RolesGuard implements GuardInterface {
  async canActivate(interaction: ChatInputCommandInteraction): Promise<boolean> {
    const required: string[] = Reflect.getMetadata('roles', interaction.constructor) ?? []
    if (!required.length) return true
    // ... validate member roles
    return true
  }
}

// Compose into a single decorator
export const RequireRoles = (...roles: string[]) =>
  applyDecorators(Roles(...roles), UseGuard(RolesGuard))

// Apply
@Command('ban', CommandType.SLASH)
@RequireRoles('admin', 'moderator')
async ban(interaction: ChatInputCommandInteraction) { ... }
```

---
