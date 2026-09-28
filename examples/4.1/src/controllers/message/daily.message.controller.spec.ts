import { createMockMessage, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-message-dm'

// #region spec
describe('DailyMessageController', () => {
  const module = MeoCordTestingModule.fromApp(App).compile()
  const fromAna = (content: string) => {
    const message = createMockMessage({ content })
    Object.assign(message.author, { id: '123456789012345678' })
    return message
  }

  it('DMs a member the cooldown refuses, once per wait', async () => {
    await module.dispatch(fromAna('!daily'))
    const retry = fromAna('!daily')
    const again = fromAna('!daily')
    await module.dispatch(retry)
    await module.dispatch(again)

    // The retry is answered privately, with the wait; the one after it, in the same wait, is not
    expect(retry.author.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('!daily in') }),
    )
    expect(again.author.send).not.toHaveBeenCalled()
    expect(retry.reply).not.toHaveBeenCalled()
  })

  it('DMs the author an error no filter handled, and says nothing in the channel', async () => {
    const message = fromAna('!leaderboard')
    // The testing module still rejects with the error, after the fallback has answered it
    await expect(module.dispatch(message)).rejects.toThrow('The leaderboard store is down')
    expect(message.author.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Something went wrong running !leaderboard') }),
    )
    expect(message.reply).not.toHaveBeenCalled()
  })
})
// #endregion spec
