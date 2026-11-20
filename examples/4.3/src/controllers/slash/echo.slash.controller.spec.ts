import { ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { EchoSlashController } from '@src/controllers/slash/echo.slash.controller'

describe('EchoSlashController', () => {
  it('repeats the text privately', async () => {
    const module = MeoCordTestingModule.create({ controllers: [EchoSlashController] }).compile()
    const interaction = createMockInteraction(ChatInputCommandInteraction, { commandName: 'echo' })
    interaction.options = createChatInputOptions({ text: 'hello' })

    await module.invoke(EchoSlashController, 'echo', interaction)

    expect(getResponse(interaction).calls[0]).toMatchObject({
      method: 'reply',
      payload: { content: 'hello', flags: MessageFlags.Ephemeral },
    })
  })
})
