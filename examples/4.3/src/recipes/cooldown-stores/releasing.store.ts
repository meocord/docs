import { randomUUID } from 'node:crypto'
import {
  type CooldownBatchVerdict,
  type CooldownEntry,
  type CooldownLimit,
  CooldownStore,
  type CooldownVerdict,
} from 'meocord/common'
import { Service } from 'meocord/decorator'

/** Your database's queries: each call is recorded under an id of its own, so it can be found again. */
export abstract class CooldownQueries {
  abstract consumeMany(entries: readonly CooldownEntry[], call: string): Promise<CooldownBatchVerdict>
  abstract forget(entries: readonly CooldownEntry[], call: string): Promise<void>
}

// #region store
@Service()
export class ReleasingCooldownStore extends CooldownStore {
  constructor(private readonly queries: CooldownQueries) {
    super()
  }

  consume(key: string, limit: CooldownLimit): Promise<CooldownVerdict> {
    return this.consumeMany([{ key, limit }])
  }

  async consumeMany(entries: readonly CooldownEntry[]): Promise<CooldownBatchVerdict> {
    const call = randomUUID()
    const verdict = await this.queries.consumeMany(entries, call)
    // Undoes this call alone, should it be counted after @Cooldown stopped waiting
    return verdict.allowed ? { ...verdict, release: () => this.queries.forget(entries, call) } : verdict
  }
}
// #endregion store
