import { ChatInputCommandInteraction } from 'discord.js'
import { ValidationError } from 'meocord/common'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { RemindSlashController } from '@src/controllers/slash/remind.slash.controller'

const remind = (options: Parameters<typeof createChatInputOptions>[0]) => {
  const interaction = createMockInteraction(ChatInputCommandInteraction)
  interaction.options = createChatInputOptions(options)
  return interaction
}

describe('RemindSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [RemindSlashController] }).compile()

  // #region spec
  it('receives the schema’s output, defaults applied', async () => {
    const interaction = remind({ minutes: 30 })

    await module.invoke(RemindSlashController, 'remind', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'In 30 minutes: a reminder' })
  })

  it('never runs with input the schema refuses', async () => {
    const interaction = remind({ minutes: 0 })

    await expect(module.invoke(RemindSlashController, 'remind', interaction)).rejects.toBeInstanceOf(ValidationError)
    expect(getResponse(interaction).sent).toBe(false)
  })
  // #endregion spec
})
