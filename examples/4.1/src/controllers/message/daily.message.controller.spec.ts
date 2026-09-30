import { createMockMessage, createMockUser, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-message-dm'

// #region spec
describe('DailyMessageController', () => {
  const module = MeoCordTestingModule.fromApp(App).compile()

  it('DMs a member the cooldown refuses, once per wait', async () => {
    const ana = createMockUser()
    const retry = createMockMessage({ author: ana, content: '!daily' })
    await module.dispatch(createMockMessage({ author: ana, content: '!daily' }))
    await module.dispatch(retry)
    await module.dispatch(createMockMessage({ author: ana, content: '!daily' }))

    // The retry is answered privately, with the wait; the one after it, in the same wait, is not
    expect(ana.send).toHaveBeenCalledTimes(1)
    expect(ana.send).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('!daily in') }))
    expect(retry.reply).not.toHaveBeenCalled()
  })

  it('DMs the author an error no filter handled, and says nothing in the channel', async () => {
    const message = createMockMessage({ author: createMockUser(), content: '!leaderboard' })
    // The testing module still rejects with the error, after the fallback has answered it
    await expect(module.dispatch(message)).rejects.toThrow('The leaderboard store is down')
    expect(message.author.send).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('Something went wrong running !leaderboard') }),
    )
    expect(message.reply).not.toHaveBeenCalled()
  })
})
// #endregion spec
