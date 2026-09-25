import { Service } from 'meocord/decorator'

// #region wallet
@Service()
export class WalletService {
  private readonly balances = new Map<string, number>()

  balance(userId: string): number {
    return this.balances.get(userId) ?? 0
  }

  // Asynchronous, as a database write would be
  async credit(userId: string, amount: number): Promise<void> {
    await Promise.resolve()
    this.balances.set(userId, this.balance(userId) + amount)
  }
}
// #endregion wallet
