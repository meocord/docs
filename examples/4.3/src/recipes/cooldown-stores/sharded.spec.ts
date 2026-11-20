import { ShardedCooldownStore } from 'meocord/common'
import { testCooldownStore } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

// #region spec
// Outside process sharding the store counts in this process, and checks as any other store does
testCooldownStore('ShardedCooldownStore', () => new ShardedCooldownStore(), { describe, it, expect })
// #endregion spec
