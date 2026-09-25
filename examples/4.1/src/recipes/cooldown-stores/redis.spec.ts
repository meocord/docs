import { testCooldownStore } from 'meocord/testing'
import { createClient } from 'redis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { redisCooldownStore } from '@src/recipes/cooldown-stores/redis'
import { serviceUrl } from '@src/recipes/cooldown-stores/service-url'

const server = serviceUrl('TEST_REDIS_URL')
// No reconnecting, so a server that is down fails the spec rather than hanging it
const connect = () =>
  createClient({ url: server.url(), socket: { connectTimeout: 5_000, reconnectStrategy: false } }).connect()

describe.skipIf(server.skip)('on Redis', () => {
  let redis: Awaited<ReturnType<typeof connect>>

  beforeAll(async () => {
    redis = await connect()
  })
  afterAll(() => redis?.close())

  testCooldownStore('RedisCooldownStore', () => new (redisCooldownStore(redis))(), { describe, it, expect })
})
