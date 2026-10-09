import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { SettingsCommandBuilder } from '@src/controllers/slash/builders/settings.builder'

// #region controller
@Controller()
export class SettingsSlashController {
  // The builder is declared once, on the command itself
  @Command('settings', SettingsCommandBuilder)
  async settings(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'Pick a subcommand.' })
  }

  // The full path, as Discord displays it; plain CommandType.SLASH and no builder
  @Command('settings notify email', CommandType.SLASH)
  async notifyEmail(interaction: ChatInputCommandInteraction, { enabled }: { enabled: boolean }) {
    await respond(interaction).send({ content: `Email notifications ${enabled ? 'on' : 'off'}` })
  }
}
// #endregion controller
