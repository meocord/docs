import { ChatInputCommandInteraction } from 'discord.js'
import { Controller, UseFilter } from 'meocord/decorator'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { RemindSlashController } from '@src/controllers/slash/remind.slash.controller'
import { ValidationWordsFilter } from '@src/filters/validation-words.filter'

// The remind command, answering its refusals in the bot's own words
@Controller()
@UseFilter(ValidationWordsFilter)
class WordedRemindController extends RemindSlashController {}

describe('ValidationWordsFilter', () => {
  const module = MeoCordTestingModule.create({ controllers: [WordedRemindController] }).compile()

  it('words a refusal from the fields zod reported', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)
    interaction.options = createChatInputOptions({ minutes: 2000 })

    await module.invoke(WordedRemindController, 'remind', interaction)

    expect(JSON.stringify(getResponse(interaction).calls[0].payload)).toContain('minutes must be at most 1440.')
  })
})
