import { AutocompleteInteraction } from 'discord.js'
import { createChatInputOptions, createMockInteraction, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { SearchSlashController } from '@src/controllers/slash/search.slash.controller'

describe('SearchSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [SearchSlashController] }).compile()

  it('suggests what the catalog finds for the text typed so far', async () => {
    const interaction = createMockInteraction(AutocompleteInteraction, { commandName: 'search' })
    interaction.options = createChatInputOptions({ focused: 'query', query: 'ad' })

    await module.invoke(SearchSlashController, 'completeQuery', interaction)

    expect(interaction.respond).toHaveBeenCalledWith([
      { name: 'admin', value: 'admin' },
      { name: 'adventure', value: 'adventure' },
    ])
  })
})
