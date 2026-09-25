import { ChatInputCommandInteraction, User } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotesController } from '@src/recipes/database/notes.controller'
import { type Note, NotesStore } from '@src/recipes/database/notes.store'

// #region spec
// The store, in memory: the controller is tested without a database
class MemoryNotesStore {
  private readonly rows: (Note & { userId: string })[] = []
  add = vi.fn(async (userId: string, text: string) => {
    this.rows.push({ id: this.rows.length + 1, userId, text })
  })
  list = vi.fn(async (userId: string) =>
    this.rows.filter(row => row.userId === userId).map(({ id, text }) => ({ id, text })),
  )
}

describe('NotesController', () => {
  let store: MemoryNotesStore
  let module: ReturnType<typeof compile>
  const compile = (value: MemoryNotesStore) =>
    MeoCordTestingModule.create({
      controllers: [NotesController],
      providers: [{ provide: NotesStore, useValue: value }],
    }).compile()
  beforeEach(() => {
    store = new MemoryNotesStore()
    module = compile(store)
  })
  const ada = createMockInteraction(User, { id: '111' })

  it('saves a note for the user, acknowledging privately first', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction, {
      user: ada,
      options: createChatInputOptions({ text: 'Water the plants' }),
    })

    await module.invoke(NotesController, 'add', interaction)

    expect(store.add).toHaveBeenCalledWith('111', 'Water the plants')
    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['deferReply', 'editReply'])
  })

  it("lists only the user's own notes", async () => {
    await store.add('111', 'Water the plants')
    await store.add('222', 'Not yours')
    const interaction = createMockInteraction(ChatInputCommandInteraction, { user: ada })

    await module.invoke(NotesController, 'list', interaction)

    expect(getResponse(interaction).calls.at(-1)?.payload).toMatchObject({ content: '1. Water the plants' })
  })
})
// #endregion spec
