import { createMockMessage, MeoCordTestingModule, resolveRoute } from 'meocord/testing'
import { afterEach, describe, expect, it } from 'vitest'
import GuildPrefixApp, { guildPrefixes } from '@src/app-with-guild-prefix'
import { DiceMessageController } from '@src/controllers/message/dice.message.controller'

// #region spec
describe('a prefix read from a function', () => {
  afterEach(() => guildPrefixes.clear())

  it('is given to resolveRoute, which cannot run the function', () => {
    expect(resolveRoute(GuildPrefixApp, { content: '$roll 6', prefix: '$' })?.params).toEqual({ sides: '6' })
    expect(() => resolveRoute(GuildPrefixApp, { content: '$roll 6' })).toThrow(TypeError)
  })

  it('is read by invoke from the message, as the bot reads it', async () => {
    guildPrefixes.set('1234', '$')
    const module = MeoCordTestingModule.create({ app: GuildPrefixApp, controllers: [DiceMessageController] }).compile()
    const message = Object.assign(createMockMessage({ content: '$roll 6' }), { guildId: '1234' })

    await expect(module.invoke(DiceMessageController, 'roll', message)).resolves.toEqual({ ran: true })
    expect(message.reply).toHaveBeenCalledWith(expect.stringMatching(/^[1-6]$/))
  })
})
// #endregion spec
