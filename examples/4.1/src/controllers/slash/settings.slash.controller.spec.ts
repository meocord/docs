import { ChatInputCommandInteraction } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { SettingsSlashController } from '@src/controllers/slash/settings.slash.controller'

const settings = (options: Parameters<typeof createChatInputOptions>[0]) => {
  const interaction = createMockInteraction(ChatInputCommandInteraction, { commandName: 'settings' })
  interaction.options = createChatInputOptions(options)
  return interaction
}

describe('SettingsSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [SettingsSlashController] }).compile()

  it('gives the subcommand its own handler, with its options flattened', async () => {
    const interaction = settings({ subcommandGroup: 'notify', subcommand: 'email', enabled: true })

    await module.invoke(SettingsSlashController, 'notifyEmail', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Email notifications on' })
  })
})
