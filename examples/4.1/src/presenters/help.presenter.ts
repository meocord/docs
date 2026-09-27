// #region presenter
import { EmbedBuilder } from 'discord.js'
import { Service } from 'meocord/decorator'
import { type MessageHelp, type PresentedError, type ResponseContext, type ResponsePresenter } from 'meocord/interface'

/** Styles the bot's views, and writes the built-in help as an embed. */
@Service()
export class HelpPresenter implements ResponsePresenter {
  loading({ theme }: ResponseContext) {
    return { text: 'Working on it…', emoji: theme.emojis.loading, color: theme.colors.primary }
  }

  error({ theme }: ResponseContext, { message, tone }: PresentedError) {
    return { title: 'Something went wrong', text: message, color: theme.colors[tone] }
  }

  messageHelp(help: MessageHelp) {
    if (help.kind !== 'list')
      return help.kind === 'unknown' ? `No command is called ${help.query}.` : 'Nothing to show here.'
    const embed = new EmbedBuilder()
      .setTitle('Commands')
      .setDescription(help.commands.map(entry => `\`${entry.usage}\`\n${entry.description ?? ''}`).join('\n\n'))
      .setFooter({ text: `${help.invocation} <command> shows one` })
    return { embeds: [embed] }
  }
}
// #endregion presenter
