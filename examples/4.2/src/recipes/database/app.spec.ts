import { ChatInputCommandInteraction, User } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it, vi } from 'vitest'
import App from '@src/recipes/database/app'
import { DATABASE } from '@src/recipes/database/database'

// #region spec
// A pool in memory, answering the two queries the store makes
function memoryPool() {
  const rows: { id: number; user_id: string; text: string }[] = []
  return {
    query: vi.fn(async (sql: string, [userId, text]: string[] = []) => {
      if (sql.startsWith('INSERT')) rows.push({ id: rows.length + 1, user_id: userId, text })
      return { rows: rows.filter(row => row.user_id === userId).map(({ id, text }) => ({ id, text })) }
    }),
  }
}

describe('the notes app', () => {
  it('saves and lists a note through its own wiring, with the database in memory', async () => {
    // Every controller, service and provider comes from @MeoCord; the database factory never runs
    const module = await MeoCordTestingModule.fromApp(App, {
      providers: [{ provide: DATABASE, useValue: memoryPool() }],
    })
      .compile()
      .init()
    const user = createMockInteraction(User, { id: '111' })
    const note = createMockInteraction(ChatInputCommandInteraction, {
      commandName: 'note',
      user,
      options: createChatInputOptions({ text: 'Water the plants' }),
    })
    const notes = createMockInteraction(ChatInputCommandInteraction, { commandName: 'notes', user })

    await module.dispatch(note)
    await module.dispatch(notes)

    expect(getResponse(notes).calls.at(-1)?.payload).toMatchObject({ content: '1. Water the plants' })
    await module.close()
  })
})
// #endregion spec
