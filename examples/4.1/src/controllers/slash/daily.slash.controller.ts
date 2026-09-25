import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Cooldown } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class DailySlashController {
  // #region cooldown
  @Command('daily', CommandType.SLASH)
  // Counted in the order they read: put the short one first, so a call it refuses spends none of the five
  @Cooldown({ seconds: 3 })
  @Cooldown({ uses: 5, seconds: 60 })
  async daily(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'Here is your daily reward.' })
  }
  // #endregion cooldown
}
