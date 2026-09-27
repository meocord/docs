import { ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle } from 'discord.js'
import { respond, route } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region typed
// `counter/41` gives count 41, a number; `counter/lots` matches no route
export const counter = route('counter/{count:int}')

const counterButton = (count: number) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(counter.build({ count })).setLabel(`${count}`).setStyle(ButtonStyle.Primary),
  )

@Controller()
export class CounterButtonController {
  @Command(counter, CommandType.BUTTON)
  async count(interaction: ButtonInteraction, { count }: { count: number }) {
    await respond(interaction).send({ components: [counterButton(count + 1)] })
  }
}
// #endregion typed
