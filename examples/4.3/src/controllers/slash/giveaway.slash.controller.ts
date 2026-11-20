import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { AccountAgeGuard } from '@src/guards/account-age.guard'

@Controller()
export class GiveawaySlashController {
  // #region apply
  @Command('enter', CommandType.SLASH)
  @UseGuard(AccountAgeGuard)
  async enter(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'You are in the giveaway. Good luck!' })
  }
  // #endregion apply
}
