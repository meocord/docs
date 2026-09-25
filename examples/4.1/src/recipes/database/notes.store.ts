import { Inject, Service } from 'meocord/decorator'
import type pg from 'pg'
import { DATABASE } from '@src/recipes/database/database'

// #region store
export interface Note {
  id: number
  text: string
}

// The queries for notes: the pool comes from the provider, so this class never connects or closes
@Service()
export class NotesStore {
  constructor(@Inject(DATABASE) private readonly pool: pg.Pool) {}

  async add(userId: string, text: string): Promise<void> {
    await this.pool.query('INSERT INTO notes (user_id, text) VALUES ($1, $2)', [userId, text])
  }

  async list(userId: string): Promise<Note[]> {
    const { rows } = await this.pool.query<Note>('SELECT id, text FROM notes WHERE user_id = $1 ORDER BY id', [userId])
    return rows
  }
}
// #endregion store
