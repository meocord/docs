import { type APIButtonComponentWithCustomId, ButtonInteraction } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import {
  createMockInteraction,
  createMockUser,
  getResponse,
  MeoCordTestingModule,
  useStrictMocks,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { CardButtonController } from '@src/controllers/button/card.button.controller'

// The click's message holds the button clicked, as on Discord, so the lock has a control to disable
useStrictMocks()

const click = (customId: string, userId: string) =>
  createMockInteraction(ButtonInteraction, { customId, user: createMockUser({ id: userId }) })
const buttonsOf = (payload: unknown) =>
  (payload as { components: { components: APIButtonComponentWithCustomId[] }[] }).components.flatMap(
    row => row.components,
  )

describe('CardButtonController', () => {
  const module = MeoCordTestingModule.create({ controllers: [CardButtonController] }).compile()

  it('acknowledges before the guard, locks the message, then answers the owner with an edit', async () => {
    const interaction = click('card/111111111111111111/refresh', '111111111111111111')

    await module.invoke(CardButtonController, 'refresh', interaction)

    const calls = getResponse(interaction).calls
    expect(calls.map(call => call.method)).toEqual(['deferUpdate', 'editReply', 'editReply'])
    // The lock disables the button while the handler runs, and the answer gives it back
    expect(buttonsOf(calls[1]!.payload)[0]).toMatchObject({ disabled: true })
    expect(buttonsOf(calls[2]!.payload)[0]).not.toHaveProperty('disabled')
  })

  it('refuses a stranger before the handler runs, and never touches the message', async () => {
    const interaction = click('card/111111111111111111/refresh', '222222222222222222')

    // The bot answers a GuardDeniedError privately; in a test, where no fallback runs, invoke rejects with it
    await expect(module.invoke(CardButtonController, 'refresh', interaction)).rejects.toThrow(GuardDeniedError)
    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['deferUpdate'])
  })

  it('answers a fast handler with a single update under auto', async () => {
    const interaction = click('card/111111111111111111/like', '111111111111111111')

    await module.invoke(CardButtonController, 'like', interaction)

    expect(getResponse(interaction).calls.map(call => call.method)).toEqual(['update'])
  })
})
