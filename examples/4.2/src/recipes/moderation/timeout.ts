import { randomInt } from 'node:crypto'
import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  DiscordAPIError,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  RESTJSONErrorCodes,
  SlashCommandBuilder,
  type User,
} from 'discord.js'
import { type ExecutionContext, GuardDeniedError, respond, route } from 'meocord/common'
import { Catch, Command, CommandBuilder, Controller, Guard, Service, UseFilter, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type ExceptionFilter, type GuardInterface } from 'meocord/interface'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class TimeoutCommandBuilder {
  build(commandName: string) {
    return (
      new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Time a member out')
        // Discord shows the command only to members who can time others out, and only in servers
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option => option.setName('member').setDescription('Who').setRequired(true))
        .addIntegerOption(option =>
          option.setName('minutes').setDescription('How long').setRequired(true).setMinValue(1).setMaxValue(10080),
        )
        .addStringOption(option => option.setName('reason').setDescription('Why').setMaxLength(200))
    )
  }
}
// #endregion builder

// #region service
export interface Timeout {
  moderatorId: string
  targetId: string
  minutes: number
  reason: string
}

// Timeouts waiting for their moderator's answer, and the log of those carried out
@Service()
export class ModerationService {
  private readonly pending = new Map<number, Timeout>()
  readonly log: (Timeout & { at: Date })[] = []

  propose(timeout: Timeout): number {
    // Random, so a button from before a restart almost certainly matches no proposal made after it
    let id = randomInt(2 ** 48 - 1)
    while (this.pending.has(id)) id = randomInt(2 ** 48 - 1)
    this.pending.set(id, timeout)
    return id
  }

  /** The proposal, removed so it runs once; undefined when it was already answered. */
  take(id: number): Timeout | undefined {
    const timeout = this.pending.get(id)
    this.pending.delete(id)
    return timeout
  }

  record(timeout: Timeout): void {
    this.log.push({ ...timeout, at: new Date() })
  }
}
// #endregion service

// #region guard
// Only the member whose id the button carries may press it
@Guard()
export class OwnerGuard implements GuardInterface {
  canActivate(interaction: ButtonInteraction, { ownerId }: { ownerId: string }): boolean {
    if (interaction.user.id !== ownerId) throw new GuardDeniedError('Only the member who opened this can use it.')
    return true
  }
}
// #endregion guard

// #region filter
@Catch(DiscordAPIError)
export class MissingPermissionsFilter implements ExceptionFilter<DiscordAPIError> {
  async catch(error: DiscordAPIError, context: ExecutionContext) {
    // The bot's role lacks the permission, or sits below the member's highest role
    const message =
      error.code === RESTJSONErrorCodes.MissingPermissions
        ? 'I can’t do that: my role needs the permission, and must be above the member’s highest role.'
        : undefined
    await context.response?.error(error, { message, visibility: 'private' })
  }
}
// #endregion filter

// #region controller
// The moderator, the proposal and the answer, such as `timeout/111/1/confirm`
export const timeoutAnswer = route('timeout/{ownerId:snowflake}/{id:int}/{action:confirm|cancel}')

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
    const button = (action: 'confirm' | 'cancel', label: string, style: ButtonStyle) =>
      new ButtonBuilder().setCustomId(timeoutAnswer.build({ ownerId, id, action })).setLabel(label).setStyle(style)
    await respond(interaction).send({
      content: `Time out ${member} for ${minutes} minutes?`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          button('confirm', 'Time out', ButtonStyle.Danger),
          button('cancel', 'Cancel', ButtonStyle.Secondary),
        ),
      ],
      flags: MessageFlags.Ephemeral,
    })
  }

  @Command(timeoutAnswer, CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  async answer(
    interaction: ButtonInteraction,
    { id, action }: { ownerId: string; id: number; action: 'confirm' | 'cancel' },
  ) {
    const timeout = this.moderation.take(id)
    if (!timeout || !interaction.inCachedGuild()) {
      await respond(interaction).send({ content: 'This has already been handled.', components: [] })
      return
    }
    if (action === 'cancel') {
      await respond(interaction).send({ content: 'Cancelled.', components: [] })
      return
    }
    const member = await interaction.guild.members.fetch(timeout.targetId)
    // Discord's refusal reaches MissingPermissionsFilter
    await member.timeout(timeout.minutes * 60_000, timeout.reason)
    this.moderation.record(timeout)
    await respond(interaction).send({ content: `Timed out ${member} for ${timeout.minutes} minutes.`, components: [] })
  }
}
// #endregion controller
