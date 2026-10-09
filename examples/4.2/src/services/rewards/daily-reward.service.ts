import { Service } from 'meocord/decorator'
import { WalletService } from '@src/services/rewards/wallet.service'

// #region reward
// Knows nothing of Discord: it takes a user id and answers whether the claim went through
@Service()
export class DailyRewardService {
  private readonly claimedOn = new Map<string, string>()

  constructor(private readonly wallet: WalletService) {}

  async claim(userId: string, now = new Date()): Promise<boolean> {
    const today = now.toISOString().slice(0, 10)
    if (this.claimedOn.get(userId) === today) return false
    // Marked before the await, so a second click arriving while credit() runs is refused
    this.claimedOn.set(userId, today)
    try {
      await this.wallet.credit(userId, 100)
    } catch (error) {
      // Nothing was paid, so the claim may be tried again
      this.claimedOn.delete(userId)
      throw error
    }
    return true
  }
}
// #endregion reward
