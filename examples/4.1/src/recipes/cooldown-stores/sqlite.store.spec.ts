import { DatabaseSync } from 'node:sqlite'
import { testCooldownStore } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { cooldownCallsTable, SqliteCooldownStore } from '@src/recipes/cooldown-stores/sqlite.store'

// #region spec
testCooldownStore(
  'SqliteCooldownStore',
  () => {
    const db = new DatabaseSync(':memory:')
    db.exec(cooldownCallsTable)
    return new SqliteCooldownStore(db)
  },
  { describe, it, expect },
)
// #endregion spec
