import { MongoClient } from 'mongodb'
import { testCooldownStore } from 'meocord/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  type CooldownDocument,
  createCooldownIndex,
  MongoCooldownStore,
} from '@src/recipes/cooldown-stores/mongo.store'
import { serviceUrl } from '@src/recipes/cooldown-stores/service-url'

const server = serviceUrl('TEST_MONGODB_URL')

describe.skipIf(server.skip)('on MongoDB', () => {
  let client: MongoClient

  beforeAll(async () => {
    client = await new MongoClient(server.url(), { serverSelectionTimeoutMS: 5_000 }).connect()
    await createCooldownIndex(client.db().collection<CooldownDocument>('cooldowns'))
  })
  afterAll(() => client?.close())

  testCooldownStore(
    'MongoCooldownStore',
    () => new MongoCooldownStore(client.db().collection<CooldownDocument>('cooldowns')),
    { describe, it, expect },
  )
})
