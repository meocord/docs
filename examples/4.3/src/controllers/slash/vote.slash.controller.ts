import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js'
import { bindTheme, respond, useTheme } from 'meocord/common'
import { Command, Controller, UseTheme } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class VoteSlashController {
  // #region bind
  @Command('vote', CommandType.SLASH)
  @UseTheme({ emojis: { success: '🗳️' } })
  async vote(interaction: ChatInputCommandInteraction) {
    const yes = new ButtonBuilder().setCustomId('vote:yes').setLabel('Yes').setStyle(useTheme().buttons.success)
    const message = await respond(interaction).send({
      content: 'Ship it?',
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(yes)],
    })

    // The collector calls back from the client, outside this call: bindTheme keeps this handler's @UseTheme
    message?.createMessageComponentCollector({ time: 60_000 }).on(
      'collect',
      bindTheme(async (click: ButtonInteraction) => {
        await respond(click).send(`${useTheme().emojis.success} Counted`)
      }),
    )
  }
  // #endregion bind
}
