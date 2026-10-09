// #region spec
import { ChatInputCommandInteraction } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller'

describe('GreetingSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [GreetingSlashController] }).compile()

  it('greets by name', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)
    interaction.options = createChatInputOptions({ name: 'Ada' })

    await module.invoke(GreetingSlashController, 'greet', interaction)

    expect(getResponse(interaction).calls).toEqual([
      { method: 'reply', payload: expect.objectContaining({ content: 'Hello, Ada!' }) },
    ])
  })
})
// #endregion spec
