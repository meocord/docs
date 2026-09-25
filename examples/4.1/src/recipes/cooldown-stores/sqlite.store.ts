import { DatabaseSync } from 'node:sqlite'
import { type CooldownLimit, CooldownStore, type CooldownVerdict, createToken } from 'meocord/common'
import { Inject, Service } from 'meocord/decorator'
import { type OnShutdown, type Provider } from 'meocord/interface'

export const SQLITE = createToken<DatabaseSync>('SQLite')

// #region schema
export const cooldownCallsTable = `
  CREATE TABLE IF NOT EXISTS cooldown_calls (id INTEGER PRIMARY KEY, key TEXT NOT NULL, at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS cooldown_calls_key_at ON cooldown_calls (key, at);`
// #endregion schema

// #region provider
export const sqliteProvider: Provider = {
  provide: SQLITE,
  useFactory: () => {
    const db = new DatabaseSync(process.env.SQLITE_PATH ?? 'bot.db')
    // Another process's write is waited for, up to five seconds, rather than failing the call at once
    db.exec('PRAGMA busy_timeout = 5000')
    db.exec(cooldownCallsTable)
    return Object.assign(db, { onShutdown: () => db.close() } satisfies OnShutdown)
  },
}
// #endregion provider

// #region store
// A row per call, in an IMMEDIATE transaction: it takes the write lock before reading, so two processes on one
// database file cannot both take the last use. SQLite runs on one host, so Date.now() is one clock.
@Service()
export class SqliteCooldownStore extends CooldownStore {
  constructor(@Inject(SQLITE) private readonly db: DatabaseSync) {
    super()
  }

  consume(key: string, { uses, windowMs }: CooldownLimit): Promise<CooldownVerdict> {
    const now = Date.now()
    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db.prepare('DELETE FROM cooldown_calls WHERE key = ? AND at <= ?').run(key, now - windowMs)
      const { count, oldest } = this.db
        .prepare('SELECT count(*) AS count, min(at) AS oldest FROM cooldown_calls WHERE key = ?')
        .get(key) as { count: number; oldest: number | null }
      const allowed = count < uses
      if (allowed) this.db.prepare('INSERT INTO cooldown_calls (key, at) VALUES (?, ?)').run(key, now)
      this.db.exec('COMMIT')
      return Promise.resolve({ allowed, retryAfterMs: allowed ? 0 : oldest! + windowMs - now })
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
  }
}
// #endregion store
