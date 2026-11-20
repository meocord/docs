import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js'
import { respond, route } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region route
// One definition for the button you send and the handler that receives it
export const ticketAction = route('ticket/{id}/{action:close|reopen}')

@Controller()
export class TicketButtonController {
  @Command('ticket', CommandType.SLASH)
  async open(interaction: ChatInputCommandInteraction) {
    const close = new ButtonBuilder()
      .setCustomId(ticketAction.build({ id: 42, action: 'close' })) // 'ticket/42/close'
      .setLabel('Close')
      .setStyle(ButtonStyle.Danger)
    await respond(interaction).send({
      content: 'Ticket #42 opened.',
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(close)],
    })
  }

  @Command(ticketAction, CommandType.BUTTON)
  async act(interaction: ButtonInteraction, { id, action }: { id: string; action: 'close' | 'reopen' }) {
    const done = action === 'close' ? 'closed' : 'reopened'
    await respond(interaction).send({ content: `Ticket #${id}: ${done}.`, components: [] })
  }
}
// #endregion route
