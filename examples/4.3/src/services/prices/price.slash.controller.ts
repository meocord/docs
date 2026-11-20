import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Defer } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { PriceCache } from '@src/services/prices/price-cache.service'

// #region controller
@Controller()
export class PriceSlashController {
  constructor(private readonly cache: PriceCache) {}

  // @Defer acknowledges at once, so the call can wait for the cache as long as it takes
  @Command('price', CommandType.SLASH)
  @Defer()
  async price(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send(`A sword costs ${this.cache.price('sword')} coins.`)
  }
}
// #endregion controller
