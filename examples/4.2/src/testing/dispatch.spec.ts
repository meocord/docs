import { ButtonInteraction, MessageReaction } from 'discord.js'
import { CommandNotFoundError } from 'meocord/common'
import { ReactionHandlerAction } from 'meocord/enum'
import {
  createMockInteraction,
  createMockMessage,
  createMockUser,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-beyond-commands'
import { CardButtonController } from '@src/controllers/button/card.button.controller'
import { DiceMessageController } from '@src/controllers/message/dice.message.controller'
import { StarReactionController } from '@src/controllers/reaction/star.reaction.controller'

describe('dispatch', () => {
  // #region dispatch
  it('routes a click to the handler its customId matches, as the bot does', async () => {
    const module = MeoCordTestingModule.create({ controllers: [CardButtonController] }).compile()
    const click = createMockInteraction(ButtonInteraction, { customId: 'card/111111111111111111/like' })

    const { ran, handlers } = await module.dispatch(click)

    expect(ran).toBe(true)
    expect(handlers).toEqual([{ controller: CardButtonController, method: 'like', ran: true }])
    expect(getResponse(click).calls[0]).toMatchObject({ method: 'update', payload: { content: 'Liked.' } })
  })
  // #endregion dispatch

  // #region message
  it('reads a message after the app’s prefix, and runs the command it names', async () => {
    const module = MeoCordTestingModule.create({ app: App, controllers: [DiceMessageController] }).compile()
    const message = createMockMessage({ content: '!roll 20 for initiative' })

    const { handlers } = await module.dispatch(message)

    expect(handlers.map(({ method }) => method)).toEqual(['roll'])
    expect(message.reply).toHaveBeenCalledWith(expect.stringMatching(/^\d+ \(for initiative\)$/))
  })
  // #endregion message

  // #region reaction
  it('delivers a reaction with its user and action', async () => {
    const module = MeoCordTestingModule.create({ controllers: [StarReactionController] }).compile()
    const message = createMockMessage()
    const reaction = createMockInteraction(MessageReaction, { message, emoji: { name: '⭐' } as never })
    const user = createMockUser({ username: 'mika', bot: false })

    await module.dispatch(reaction, { user, action: ReactionHandlerAction.ADD })

    expect(message.reply).toHaveBeenCalledWith('mika starred this.')
  })
  // #endregion reaction

  // #region not-found
  it('answers a click no route takes as the bot does, and reports why', async () => {
    const module = MeoCordTestingModule.create({ controllers: [CardButtonController] }).compile()
    const click = createMockInteraction(ButtonInteraction, { customId: 'card/111111111111111111/share' })

    const { ran, handlers, error } = await module.dispatch(click)

    expect([ran, handlers]).toEqual([false, []])
    expect(error).toBeInstanceOf(CommandNotFoundError)
    expect(getResponse(click).sent).toBe(true)
  })
  // #endregion not-found
})
