import { testCooldownStore } from 'meocord/testing'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cooldownCallsTable, PostgresCooldownStore } from '@src/recipes/cooldown-stores/postgres.store'
import { serviceUrl } from '@src/recipes/cooldown-stores/service-url'

const server = serviceUrl('TEST_POSTGRES_URL')

describe.skipIf(server.skip)('on Postgres', () => {
  let pool: pg.Pool

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: server.url(), connectionTimeoutMillis: 5_000 })
    await pool.query(cooldownCallsTable)
  })
  afterAll(() => pool?.end())

  testCooldownStore('PostgresCooldownStore', () => new PostgresCooldownStore(pool), { describe, it, expect })
})
