import { createToken } from 'meocord/common'
import { type OnShutdown, type Provider } from 'meocord/interface'
import pg from 'pg'

// #region provider
// What every store injects: one pool for the whole bot, typed by its token
export const DATABASE = createToken<pg.Pool>('Database')

export const databaseProvider: Provider = {
  provide: DATABASE,
  // Awaited before login, so a database that refuses the connection stops the bot with the reason
  useFactory: async () => {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    await pool.query(
      'CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, text TEXT NOT NULL)',
    )
    // A provided value's onShutdown runs as the bot stops, after every class that injects it
    return Object.assign(pool, { onShutdown: () => pool.end() } satisfies OnShutdown)
  },
}
// #endregion provider
