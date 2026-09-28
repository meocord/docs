import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  InteractionContextType,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from 'discord.js'
import { GuardDeniedError, respond, route } from 'meocord/common'
import { Command, CommandBuilder, Controller, Cooldown, Guard, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type GuardInterface } from 'meocord/interface'

@CommandBuilder(CommandType.SLASH)
export class TicketCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Open a private ticket with the staff')
      .setContexts(InteractionContextType.Guild)
  }
}

// #region guard
// The member who opened the ticket, or staff who can manage threads, may close it
@Guard()
export class TicketCloserGuard implements GuardInterface {
  canActivate(interaction: ButtonInteraction, { ownerId }: { ownerId: string }): boolean {
    if (interaction.user.id === ownerId) return true
    if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads)) return true
    throw new GuardDeniedError('Only the member who opened this ticket, or the staff, can close it.')
  }
}
// #endregion guard

// #region controller
// The Close button carries who opened the ticket, such as `ticket/111/close`
export const closeTicket = route('ticket/{ownerId}/close')

@Controller()
export class TicketController {
  // One ticket every ten minutes per member, so the command is not a way to flood the staff
  @Command('ticket', TicketCommandBuilder)
  @Cooldown({ uses: 1, seconds: 600 })
  async open(interaction: ChatInputCommandInteraction) {
    const input = (id: string, label: string, style: TextInputStyle) =>
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId(id)
          .setLabel(label)
          .setStyle(style)
          .setMaxLength(style === TextInputStyle.Short ? 80 : 1000),
      )
    await respond(interaction).modal(
      new ModalBuilder()
        .setCustomId('ticket/create')
        .setTitle('Open a ticket')
        .addComponents(
          input('subject', 'Subject', TextInputStyle.Short),
          input('details', 'What happened?', TextInputStyle.Paragraph),
        ),
    )
  }

  // The form's fields arrive as params; the ticket is a private thread in the channel it was opened from
  @Command('ticket/create', CommandType.MODAL_SUBMIT)
  async create(interaction: ModalSubmitInteraction, { subject, details }: { subject: string; details: string }) {
    if (!(interaction.channel instanceof TextChannel)) {
      await respond(interaction).send({ content: 'Open a ticket from a text channel.', flags: MessageFlags.Ephemeral })
      return
    }
    const thread = await interaction.channel.threads.create({
      name: `ticket-${interaction.user.username}`,
      type: ChannelType.PrivateThread,
      invitable: false,
    })
    await thread.members.add(interaction.user.id)
    const close = new ButtonBuilder()
      .setCustomId(closeTicket.build({ ownerId: interaction.user.id }))
      .setLabel('Close ticket')
      .setStyle(ButtonStyle.Secondary)
    await thread.send({
      content: `**${subject}**\n${details}`,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(close)],
    })
    await respond(interaction).send({ content: `Your ticket is open: ${thread}`, flags: MessageFlags.Ephemeral })
  }

  @Command(closeTicket, CommandType.BUTTON)
  @UseGuard(TicketCloserGuard)
  async close(interaction: ButtonInteraction) {
    await respond(interaction).send({ content: `Closed by ${interaction.user}.`, components: [] })
    if (interaction.channel instanceof ThreadChannel) {
      // Locked, then archived: members keep reading it, and no one can post
      await interaction.channel.setLocked(true)
      await interaction.channel.setArchived(true)
    }
  }
}
// #endregion controller
