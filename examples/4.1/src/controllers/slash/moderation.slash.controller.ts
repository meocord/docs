import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { OnlyInChannels } from '@src/guards/channel.guard'
import { RequireRoles } from '@src/guards/roles.guard'

@Controller()
export class ModerationSlashController {
  // #region apply
  @Command('trade', CommandType.SLASH)
  @OnlyInChannels('111111111111111111')
  async trade(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'Trade opened.' })
  }

  @Command('ban', CommandType.SLASH)
  @RequireRoles('admin', 'moderator')
  async ban(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'Banned.' })
  }
  // #endregion apply
}
