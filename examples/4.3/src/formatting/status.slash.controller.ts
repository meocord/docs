import { type ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js'
import {
  commandMention,
  DiscordLimits,
  formatDuration,
  respond,
  splitMessage,
  time,
  TimestampStyles,
  truncate,
  userMention,
} from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { NeedsPermissions } from '@src/formatting/permissions.guard'
import { RULES } from '@src/formatting/rules'

@Controller()
export class StatusSlashController {
  // #region mention
  @Command('notify', CommandType.SLASH)
  async notify(interaction: ChatInputCommandInteraction) {
    const command = await commandMention('settings notify email', interaction)
    await respond(interaction).send(`Turn email notifications on with ${command}.`)
  }
  // #endregion mention

  // #region duration
  @Command('uptime', CommandType.SLASH)
  async uptime(interaction: ChatInputCommandInteraction) {
    // "1 hour, 5 minutes" after 3,900 seconds, in the member's language
    const up = formatDuration(process.uptime() * 1000, interaction, { style: 'long' })
    await respond(interaction).send(`Up for ${up}.`)
  }
  // #endregion duration

  // #region permissions
  @Command('purge', CommandType.SLASH)
  @NeedsPermissions(PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ReadMessageHistory)
  async purge(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send('Purged.')
  }
  // #endregion permissions

  // #region split
  @Command('rules', CommandType.SLASH)
  async rules(interaction: ChatInputCommandInteraction) {
    // Each part at most 2000 characters, cut at a line end
    const [first, ...rest] = splitMessage(RULES)
    await respond(interaction).send(first ?? 'No rules yet.')
    for (const content of rest) await respond(interaction).followUp(content)
  }
  // #endregion split

  // #region truncate
  @Command('summary', CommandType.SLASH)
  async summary(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder().setTitle('Rules').setDescription(truncate(RULES, DiscordLimits.embedDescription))
    await respond(interaction).send({ embeds: [embed] })
  }
  // #endregion truncate

  // #region formatters
  @Command('whois', CommandType.SLASH)
  async whois(interaction: ChatInputCommandInteraction) {
    const { user } = interaction
    await respond(interaction).send(
      `${userMention(user.id)} joined Discord ${time(user.createdAt, TimestampStyles.RelativeTime)}.`,
    )
  }
  // #endregion formatters
}
