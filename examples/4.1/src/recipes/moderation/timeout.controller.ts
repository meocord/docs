import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  MessageFlags,
  type User,
} from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, UseFilter, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { OwnerGuard } from '@src/guards/owner.guard'
import { MissingPermissionsFilter } from '@src/recipes/moderation/missing-permissions.filter'
import { ModerationService } from '@src/recipes/moderation/moderation.service'
import { TimeoutCommandBuilder } from '@src/recipes/moderation/timeout.builder'

// #region controller
@Controller()
@UseFilter(MissingPermissionsFilter)
export class TimeoutController {
  constructor(private readonly moderation: ModerationService) {}

  // Asks the moderator to confirm, privately; the proposal waits in the service, not in the customId
  @Command('timeout', TimeoutCommandBuilder)
  async propose(
    interaction: ChatInputCommandInteraction,
    { member, minutes, reason }: { member: User; minutes: number; reason?: string },
  ) {
    const ownerId = interaction.user.id
    const id = this.moderation.propose({
      moderatorId: ownerId,
      targetId: member.id,
      minutes,
      reason: reason ?? 'No reason given',
    })
    const button = (action: 'confirm' | 'cancel', style: ButtonStyle) =>
      new ButtonBuilder()
        .setCustomId(`timeout/${ownerId}/${id}/${action}`)
        .setLabel(action === 'confirm' ? 'Time out' : 'Cancel')
        .setStyle(style)
    await respond(interaction).send({
      content: `Time out ${member} for ${minutes} minutes?`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          button('confirm', ButtonStyle.Danger),
          button('cancel', ButtonStyle.Secondary),
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  }

  @Command('timeout/{ownerId}/{id}/confirm', CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  async confirm(interaction: ButtonInteraction, { id }: { id: string }) {
    const timeout = this.moderation.take(id)
    if (!timeout || !interaction.inCachedGuild()) {
      await respond(interaction).send({ content: 'This has already been handled.', components: [] })
      return
    }
    const member = await interaction.guild.members.fetch(timeout.targetId)
    // Discord's refusal, 50013, reaches MissingPermissionsFilter
    await member.timeout(timeout.minutes * 60_000, timeout.reason)
    this.moderation.record(timeout)
    await respond(interaction).send({ content: `Timed out ${member} for ${timeout.minutes} minutes.`, components: [] })
  }

  @Command('timeout/{ownerId}/{id}/cancel', CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  async cancel(interaction: ButtonInteraction, { id }: { id: string }) {
    this.moderation.take(id)
    await respond(interaction).send({ content: 'Cancelled.', components: [] })
  }
}
// #endregion controller
