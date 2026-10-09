import { inspectHandler } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ShopSlashController } from '@src/controllers/slash/shop.slash.controller'
import { ChannelGuard } from '@src/guards/channel.guard'

// #region spec
describe('ShopSlashController', () => {
  it('gets the guard and the cooldown the decorator combines', () => {
    const shop = inspectHandler(ShopSlashController, 'shop')

    expect(shop.guards).toEqual([{ provide: ChannelGuard, params: { channelIds: ['111111111111111111'] } }])
    expect(shop.cooldowns).toEqual([expect.objectContaining({ seconds: 10 })])
  })
})
// #endregion spec
