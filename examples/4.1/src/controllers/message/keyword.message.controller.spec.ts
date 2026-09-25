import { createMockMessage, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-beyond-commands'
import { KeywordMessageController } from '@src/controllers/message/keyword.message.controller'

// #region spec
describe('KeywordMessageController', () => {
  // With the app, a message is matched after its prefix, as the bot matches it
  const module = MeoCordTestingModule.create({ app: App, controllers: [KeywordMessageController] }).compile()

  it('answers !ping', async () => {
    const message = createMockMessage({ content: '!PING' })

    await expect(module.invoke(KeywordMessageController, 'ping', message)).resolves.toEqual({ ran: true })
    expect(message.reply).toHaveBeenCalledWith('Pong!')
  })

  it('refuses a message its pattern does not match', async () => {
    await expect(
      module.invoke(KeywordMessageController, 'ping', createMockMessage({ content: 'ping' })),
    ).rejects.toThrow()
  })

  it('counts every message', async () => {
    await module.invoke(KeywordMessageController, 'count')

    expect(module.get(KeywordMessageController).messagesSeen).toBe(1)
  })
})
// #endregion spec
