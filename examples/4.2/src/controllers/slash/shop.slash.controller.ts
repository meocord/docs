import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { Protected } from '@src/decorators/protected.decorator'

@Controller()
export class ShopSlashController {
  // #region use
  @Command('shop', CommandType.SLASH)
  @Protected('111111111111111111', 10)
  async shop(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'The shop is open.' })
  }
  // #endregion use
}
