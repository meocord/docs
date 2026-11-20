import { ChatInputCommandInteraction } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule, useStrictMocks } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-wait-for-ready'

useStrictMocks()

// #region spec
describe('PriceSlashController', () => {
  it('waits for the cache to warm before it answers', async () => {
    const module = MeoCordTestingModule.fromApp(App).compile()
    const ready = module.init({ ready: true })

    // Made while onReady still warms the cache: the call waits for it
    const interaction = createMockInteraction(ChatInputCommandInteraction, { commandName: 'price' })
    await module.dispatch(interaction)
    await ready

    expect(getResponse(interaction).calls.at(-1)?.payload).toMatchObject({ content: 'A sword costs 120 coins.' })
    await module.close()
  })
})
// #endregion spec
