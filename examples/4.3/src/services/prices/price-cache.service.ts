// #region cache
import { Service } from 'meocord/decorator'
import { type OnReady } from 'meocord/interface'

@Service()
export class PriceCache implements OnReady {
  private readonly prices = new Map<string, number>()

  // Warms the cache from the shop's API; with waitForReady, a call that uses the cache waits for this
  async onReady() {
    for (const [item, price] of await this.fetchPrices()) this.prices.set(item, price)
  }

  price(item: string): number | undefined {
    return this.prices.get(item)
  }

  // Stands in for a request to the shop's API
  private async fetchPrices(): Promise<[string, number][]> {
    await new Promise(resolve => setTimeout(resolve, 50))
    return [['sword', 120]]
  }
}
// #endregion cache
