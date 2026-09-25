import { createMockMessage, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { KeywordMessageController } from '@src/controllers/message/keyword.message.controller'

// #region spec
describe('KeywordMessageController', () => {
  const module = MeoCordTestingModule.create({ controllers: [KeywordMessageController] }).compile()

  it('answers the keyword', async () => {
    const message = createMockMessage()

    await expect(module.invoke(KeywordMessageController, 'ping', message)).resolves.toEqual({ ran: true })
    expect(message.reply).toHaveBeenCalledWith('Pong!')
  })

  it('counts every message', async () => {
    await module.invoke(KeywordMessageController, 'count')

    expect(module.get(KeywordMessageController).messagesSeen).toBe(1)
  })
})
// #endregion spec
