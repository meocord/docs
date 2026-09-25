import { type ChatInputCommandInteraction } from 'discord.js'
import { getInstallContext, respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class StatsSlashController {
  // #region where
  @Command('stats', CommandType.SLASH)
  async stats(interaction: ChatInputCommandInteraction) {
    const { where, botInstalled } = getInstallContext(interaction)
    // In a server the bot is not in, keep the answer to the user who asked
    const ephemeral = where === 'guild' && !botInstalled
    await respond(interaction).send({ content: `Asked in ${where}.`, ephemeral })
  }
  // #endregion where
}
