import { createMockFn, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { DATABASE } from '@src/recipes/database/database'
import { NotesStore } from '@src/recipes/database/notes.store'

// #region spec
describe('NotesStore', () => {
  it('queries through the injected pool, with the user id as a parameter', async () => {
    const query = createMockFn().mockResolvedValue({ rows: [{ id: 1, text: 'Water the plants' }] })
    // A stand-in for the pool under the same token, so the store's own code runs with no database
    const module = MeoCordTestingModule.create({
      providers: [
        { provide: DATABASE, useValue: { query } },
        { provide: NotesStore, useClass: NotesStore },
      ],
    }).compile()

    await expect(module.get(NotesStore).list('111')).resolves.toEqual([{ id: 1, text: 'Water the plants' }])
    expect(query).toHaveBeenCalledWith('SELECT id, text FROM notes WHERE user_id = $1 ORDER BY id', ['111'])
  })
})
// #endregion spec
