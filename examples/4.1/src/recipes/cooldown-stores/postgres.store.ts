import { type CooldownLimit, CooldownStore, type CooldownVerdict } from 'meocord/common'
import { Inject, Service } from 'meocord/decorator'
import type pg from 'pg'
import { DATABASE } from '@src/recipes/database/database'

// #region schema
export const cooldownCallsTable = `
  CREATE TABLE IF NOT EXISTS cooldown_calls (
    id bigserial PRIMARY KEY,
    key text NOT NULL,
    at timestamptz NOT NULL DEFAULT clock_timestamp()
  );
  CREATE INDEX IF NOT EXISTS cooldown_calls_key_at ON cooldown_calls (key, at);`
// #endregion schema

// #region store
// A row per call, counted in a transaction that holds an advisory lock on the key, by the database's clock
@Service()
export class PostgresCooldownStore extends CooldownStore {
  constructor(@Inject(DATABASE) private readonly pool: pg.Pool) {
    super()
  }

  async consume(key: string, { uses, windowMs }: CooldownLimit): Promise<CooldownVerdict> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')
      // Serialises the key's calls, even its first, which has no row yet to lock
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key])
      await client.query(
        `DELETE FROM cooldown_calls WHERE key = $1 AND at <= clock_timestamp() - $2::float8 * interval '1 millisecond'`,
        [key, windowMs],
      )
      const { rows } = await client.query<{ count: number; retry: number | null }>(
        `SELECT count(*)::int AS count,
                ceil(extract(epoch FROM min(at) + $2::float8 * interval '1 millisecond' - clock_timestamp()) * 1000)::int AS retry
         FROM cooldown_calls WHERE key = $1`,
        [key, windowMs],
      )
      const allowed = rows[0].count < uses
      if (allowed) await client.query('INSERT INTO cooldown_calls (key) VALUES ($1)', [key])
      await client.query('COMMIT')
      return { allowed, retryAfterMs: allowed ? 0 : rows[0].retry! }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
// #endregion store
