import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import { respond, useTheme } from 'meocord/common'
import { Command, Controller, Defer, UseTheme } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region store
@Controller()
@UseTheme({ colors: { primary: '#26A042' } })
export class StoreSlashController {
  // #region read
  @Command('receipt', CommandType.SLASH)
  async receipt(interaction: ChatInputCommandInteraction) {
    const { colors, emojis } = useTheme()
    const receipt = new EmbedBuilder().setDescription(`${emojis.success} Paid`).setColor(colors.success)
    await respond(interaction).send({ embeds: [receipt] })
  }
  // #endregion read

  // #region fill
  @Command('refund', CommandType.SLASH)
  @UseTheme({ colors: { primary: '#E3606D' }, emojis: { loading: '💸' } })
  @Defer()
  async refund(interaction: ChatInputCommandInteraction) {
    // No colour set, so respond() gives the embed this handler's primary, #E3606D
    await respond(interaction).send({ embeds: [new EmbedBuilder().setDescription('Refunded')] })
  }

  @Command('banner', CommandType.SLASH)
  async banner(interaction: ChatInputCommandInteraction) {
    // Sent as written: Discord's own stripe, whatever the theme
    const banner = new EmbedBuilder().setImage('https://meocord.dev/og.png')
    await respond(interaction).send({ embeds: [banner] }, { fill: false })
  }
  // #endregion fill
}
// #endregion store
