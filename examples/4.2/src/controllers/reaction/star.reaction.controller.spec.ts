import { MessageReaction } from 'discord.js'
import { ReactionHandlerAction } from 'meocord/enum'
import { createMockInteraction, createMockMessage, createMockUser, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { StarReactionController } from '@src/controllers/reaction/star.reaction.controller'

// #region spec
describe('StarReactionController', () => {
  const module = MeoCordTestingModule.create({ controllers: [StarReactionController] }).compile()
  const user = createMockUser({ username: 'mika', bot: false })

  it('replies when a star is added, and not when one is removed', async () => {
    const message = createMockMessage()
    const reaction = createMockInteraction(MessageReaction, { message })

    await module.invoke(StarReactionController, 'star', reaction, { user, action: ReactionHandlerAction.ADD })
    await module.invoke(StarReactionController, 'star', reaction, { user, action: ReactionHandlerAction.REMOVE })

    expect(message.reply).toHaveBeenCalledTimes(1)
    expect(message.reply).toHaveBeenCalledWith('mika starred this.')
  })
})
// #endregion spec
