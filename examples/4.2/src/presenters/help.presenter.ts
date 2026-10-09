// #region presenter
import { EmbedBuilder } from 'discord.js'
import { Service } from 'meocord/decorator'
import {
  type MessageHelp,
  type MessageHelpEntry,
  type PresentedError,
  type ResponseContext,
  type ResponsePresenter,
} from 'meocord/interface'

/** Each command's usage, then what it does. */
const usages = (entries: MessageHelpEntry[]) =>
  entries.map(entry => `\`${entry.usage}\`\n${entry.description ?? ''}`).join('\n\n')

/** Styles the bot's views, and writes the built-in help as embeds. */
@Service()
export class HelpPresenter implements ResponsePresenter {
  loading({ theme }: ResponseContext) {
    return { text: 'Working on it…', emoji: theme.emojis.loading, color: theme.colors.primary }
  }

  error({ theme }: ResponseContext, { message, tone }: PresentedError) {
    return { title: 'Something went wrong', text: message, color: theme.colors[tone] }
  }

  messageHelp(help: MessageHelp) {
    switch (help.kind) {
      case 'list':
        return {
          embeds: [
            new EmbedBuilder()
              .setTitle('Commands')
              .setDescription(usages(help.commands))
              .setFooter({ text: `${help.invocation} <command> shows one` }),
          ],
        }
      case 'command':
        // One embed for each handler the name reaches, with its params and aliases
        return {
          embeds: help.commands.map(entry =>
            new EmbedBuilder()
              .setTitle(entry.usage)
              .setDescription(entry.description ?? null)
              .addFields(
                entry.params.map(({ name, label, optional }) => ({
                  name: optional ? `${name} (optional)` : name,
                  value: label,
                  inline: true,
                })),
              )
              .setFooter(entry.aliases.length > 0 ? { text: `Also: ${entry.aliases.join(', ')}` } : null),
          ),
        }
      case 'parent':
        return { embeds: [new EmbedBuilder().setTitle('Subcommands').setDescription(usages(help.subcommands))] }
      case 'unknown':
        return `No command is called ${help.query}. ${help.invocation} lists them.`
      case 'empty':
        return help.reason === 'server-only' ? 'The commands work in servers only.' : 'No commands to show here.'
    }
  }
}
// #endregion presenter
