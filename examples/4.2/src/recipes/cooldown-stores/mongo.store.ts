import { randomUUID } from 'node:crypto'
import { type CooldownLimit, CooldownStore, type CooldownVerdict, createToken } from 'meocord/common'
import { Inject, Service } from 'meocord/decorator'
import { type OnShutdown, type Provider } from 'meocord/interface'
import { type Collection, MongoClient } from 'mongodb'

export interface CooldownDocument {
  _id: string
  calls: { at: Date; id: string }[]
  expiresAt: Date
  now: Date
}

export const COOLDOWNS = createToken<Collection<CooldownDocument>>('Cooldowns')

// #region provider
// A TTL index on expiresAt removes a key's document once its window has passed
export const createCooldownIndex = (cooldowns: Collection<CooldownDocument>) =>
  cooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const cooldownsProvider: Provider = {
  provide: COOLDOWNS,
  useFactory: async () => {
    const client = await new MongoClient(process.env.MONGODB_URL!).connect()
    const cooldowns = client.db().collection<CooldownDocument>('cooldowns')
    await createCooldownIndex(cooldowns)
    return Object.assign(cooldowns, { onShutdown: () => client.close() } satisfies OnShutdown)
  },
}
// #endregion provider

// #region store
// One document per key, trimmed, counted and appended to by one findOneAndUpdate with an update pipeline, so
// the check and the record are one atomic write, timed by the server's $$NOW
@Service()
export class MongoCooldownStore extends CooldownStore {
  constructor(@Inject(COOLDOWNS) private readonly cooldowns: Collection<CooldownDocument>) {
    super()
  }

  async consume(key: string, { uses, windowMs }: CooldownLimit): Promise<CooldownVerdict> {
    // Tells this call apart from another in the same millisecond
    const id = randomUUID()
    const inWindow = {
      $filter: { input: { $ifNull: ['$calls', []] }, cond: { $gt: ['$$this.at', { $subtract: ['$$NOW', windowMs] }] } },
    }
    const doc = await this.cooldowns.findOneAndUpdate(
      { _id: key },
      [
        { $set: { calls: inWindow } },
        {
          $set: {
            calls: {
              $cond: [
                { $lt: [{ $size: '$calls' }, uses] },
                { $concatArrays: ['$calls', [{ at: '$$NOW', id }]] },
                '$calls',
              ],
            },
            expiresAt: { $add: ['$$NOW', windowMs] },
            now: '$$NOW',
          },
        },
      ],
      { upsert: true, returnDocument: 'after' },
    )
    if (doc!.calls.some(call => call.id === id)) return { allowed: true, retryAfterMs: 0 }
    return { allowed: false, retryAfterMs: doc!.calls[0].at.getTime() + windowMs - doc!.now.getTime() }
  }
}
// #endregion store
