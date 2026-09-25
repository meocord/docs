import { ChatInputCommandInteraction, User } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { KickSlashController } from '@src/controllers/slash/kick.slash.controller'

describe('KickSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [KickSlashController] }).compile()

  it('receives the target resolved to a user', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)
    interaction.options = createChatInputOptions({
      target: createMockInteraction(User, { username: 'ada' }),
      reason: 'spam',
    })

    await module.invoke(KickSlashController, 'kick', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Kicked ada: spam' })
  })
})
