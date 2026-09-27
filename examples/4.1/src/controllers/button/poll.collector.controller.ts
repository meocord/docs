import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  ComponentType,
} from 'discord.js'
import { bindTheme, respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region collector
@Controller()
export class QuickPollController {
  @Command('quickpoll', CommandType.SLASH)
  async start(interaction: ChatInputCommandInteraction) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('quickpoll-yes').setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('quickpoll-no').setLabel('No').setStyle(ButtonStyle.Secondary),
    )
    const message = await respond(interaction).send({ content: 'Ship it?', components: [row] })

    // No @Command routes these clicks: the collector answers them, for one minute
    message?.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000 }).on(
      'collect',
      bindTheme(async (click: ButtonInteraction) => {
        await respond(click).send({
          embeds: [{ description: `${click.user.username} voted ${click.customId.slice(10)}` }],
        })
      }),
    )
  }
}
// #endregion collector
