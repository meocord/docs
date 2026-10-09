import { ChatInputCommandInteraction } from 'discord.js'
import { createChatInputOptions, createMockInteraction, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { stages, StagesSlashController } from '@src/controllers/slash/stages.slash.controller'

// #region spec
describe('the stages of a call', () => {
  it('run in order: @Defer, guards, interceptors around the pipes and the handler', async () => {
    const module = MeoCordTestingModule.create({ controllers: [StagesSlashController] }).compile()
    const interaction = createMockInteraction(ChatInputCommandInteraction)
    interaction.options = createChatInputOptions({ text: '  hello  ' })

    await module.invoke(StagesSlashController, 'run', interaction)

    expect(stages).toEqual(['guard, deferred: true', 'interceptor, before', 'pipe', 'handler', 'interceptor, after'])
  })
})
// #endregion spec
