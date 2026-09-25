import { ValidationError } from 'meocord/common'
import { createMockMessage, MeoCordTestingModule, resolveRoute } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-beyond-commands'
import { DiceMessageController } from '@src/controllers/message/dice.message.controller'

// #region spec
describe('DiceMessageController', () => {
  it('routes each message to the one handler that matches it', () => {
    expect(resolveRoute(App, { content: '!roll 20 for initiative' })).toMatchObject({
      handler: DiceMessageController.prototype.roll,
      params: { sides: '20', note: 'for initiative' },
    })
    expect(resolveRoute(App, { content: '<@42> roll 6', botId: '42' })?.params).toEqual({ sides: '6' })
    expect(resolveRoute(App, { content: '??coin' })?.handler).toBe(DiceMessageController.prototype.coin)
    // The handler's own prefixes replace the app's
    expect(resolveRoute(App, { content: '!coin' })).toBeUndefined()
    expect(resolveRoute(App, { content: 'Good Morning' })?.handler).toBe(DiceMessageController.prototype.greet)
  })

  const module = MeoCordTestingModule.create({ app: App, controllers: [DiceMessageController] }).compile()

  it('rolls with the params the pattern captures, validated', async () => {
    const message = createMockMessage({ content: '!roll 20 for initiative' })

    await module.invoke(DiceMessageController, 'roll', message)
    expect(message.reply).toHaveBeenCalledWith(expect.stringMatching(/^\d+ \(for initiative\)$/))

    await expect(
      module.invoke(DiceMessageController, 'roll', createMockMessage({ content: '!roll 1' })),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
// #endregion spec
