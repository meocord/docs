import { type ChatInputCommandInteraction, EmbedBuilder, GatewayIntentBits } from 'discord.js'
import { respond, useTheme } from 'meocord/common'
import { Command, Controller, MeoCord } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class VipSlashController {
  // #region read
  @Command('vip', CommandType.SLASH)
  async vip(interaction: ChatInputCommandInteraction) {
    // The app's own role, typed and always set: the root theme has to give it
    await respond(interaction).send({
      embeds: [new EmbedBuilder().setDescription('Welcome back').setColor(useTheme().colors.vip)],
    })
  }
  // #endregion read
}

// #region app
@MeoCord({
  controllers: [VipSlashController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  // MeoCord's roles are optional here; the app's own, which have no default, are not
  theme: {
    colors: { vip: '#D4AF37' },
    charts: { axis: '#888B95', series: ['#7680F4', '#26A042'] },
  },
})
export default class App {}
// #endregion app
