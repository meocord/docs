import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, UseFilter } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { RateLimitedError, RateLimitedFilter } from '@src/filters/rate-limited.filter'

// #region controller
@Controller()
@UseFilter(RateLimitedFilter)
export class QuoteSlashController {
  private remaining = 1

  @Command('quote', CommandType.SLASH)
  async quote(interaction: ChatInputCommandInteraction) {
    // Stands in for a call to a rate-limited API
    if (this.remaining-- <= 0) throw new RateLimitedError(30)
    await respond(interaction).send({ content: 'Stay hungry, stay foolish.' })
  }
}
// #endregion controller
