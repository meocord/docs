import { describe, expect, it } from 'vitest'
import { DailyRewardService } from '@src/services/rewards/daily-reward.service'
import { WalletService } from '@src/services/rewards/wallet.service'

// #region spec
describe('DailyRewardService', () => {
  // A plain class: built with new, its dependency passed in by hand
  const setup = () => {
    const wallet = new WalletService()
    return { wallet, rewards: new DailyRewardService(wallet) }
  }

  it('pays once a day, even for two claims made at the same moment', async () => {
    const { wallet, rewards } = setup()

    await expect(Promise.all([rewards.claim('111'), rewards.claim('111')])).resolves.toEqual([true, false])
    expect(wallet.balance('111')).toBe(100)

    await expect(rewards.claim('111', new Date(Date.now() + 24 * 60 * 60_000))).resolves.toBe(true)
  })

  it('lets a claim that failed to pay be tried again', async () => {
    const { wallet, rewards } = setup()
    const credit = wallet.credit.bind(wallet)
    wallet.credit = async () => Promise.reject(new Error('database unavailable'))

    await expect(rewards.claim('111')).rejects.toThrow('database unavailable')

    wallet.credit = credit
    await expect(rewards.claim('111')).resolves.toBe(true)
  })
})
// #endregion spec
