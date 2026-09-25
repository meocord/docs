import { ButtonInteraction, User } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { CardButtonController } from '@src/controllers/button/card.button.controller'

const click = (customId: string, userId: string) =>
  createMockInteraction(ButtonInteraction, { customId, user: createMockInteraction(User, { id: userId }) })

describe('CardButtonController', () => {
  const module = MeoCordTestingModule.create({ controllers: [CardButtonController] }).compile()

  it('acknowledges before the guard, then answers the owner with an edit', async () => {
    const interaction = click('card/111/refresh', '111')

    await module.invoke(CardButtonController, 'refresh', interaction)

    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['deferUpdate', 'editReply'])
  })

  it('refuses a stranger before the handler runs, and never touches the message', async () => {
    const interaction = click('card/111/refresh', '222')

    // The bot answers a GuardDeniedError privately; in a test, where no fallback runs, invoke rejects with it
    await expect(module.invoke(CardButtonController, 'refresh', interaction)).rejects.toThrow(GuardDeniedError)
    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['deferUpdate'])
  })

  it('answers a fast handler with a single update under auto', async () => {
    const interaction = click('card/111/like', '111')

    await module.invoke(CardButtonController, 'like', interaction)

    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['update'])
  })
})
