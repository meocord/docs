import { Service } from 'meocord/decorator'
import { type OnReady, type OnShutdown } from 'meocord/interface'
import pg from 'pg'

// #region store
export interface Note {
  id: number
  text: string
}

// The one place that talks to the database: handlers inject it, and tests replace it
@Service()
export class NotesStore implements OnReady, OnShutdown {
  // A pool opens connections as queries need them, so constructing it connects to nothing
  private readonly pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

  async onReady() {
    await this.pool.query(
      'CREATE TABLE IF NOT EXISTS notes (id SERIAL PRIMARY KEY, user_id TEXT NOT NULL, text TEXT NOT NULL)',
    )
  }

  async onShutdown() {
    await this.pool.end()
  }

  async add(userId: string, text: string): Promise<void> {
    await this.pool.query('INSERT INTO notes (user_id, text) VALUES ($1, $2)', [userId, text])
  }

  async list(userId: string): Promise<Note[]> {
    const { rows } = await this.pool.query<Note>('SELECT id, text FROM notes WHERE user_id = $1 ORDER BY id', [userId])
    return rows
  }
}
// #endregion store
