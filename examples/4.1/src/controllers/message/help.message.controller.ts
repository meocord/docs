// #region help
import { type Message } from 'discord.js'
import { HandlerRegistry } from 'meocord/core'
import { Controller, MessageHandler } from 'meocord/decorator'

@Controller()
export class HelpMessageController {
  constructor(private readonly handlers: HandlerRegistry) {}

  // !help lists the commands in a code block; !help mute, or !help m, shows one
  @MessageHandler('help {command...?}', { description: 'Lists the commands, or shows one.' })
  async help(message: Message, { command }: { command?: string }) {
    const help = await this.handlers.messageHelp(message, command)
    if (help.kind === 'list') {
      await message.reply(['```', ...help.commands.map(entry => entry.usage), '```'].join('\n'))
    } else if (help.kind === 'command') {
      await message.reply(
        help.commands.map(entry => [entry.usage, entry.description].filter(Boolean).join(': ')).join('\n'),
      )
    } else if (help.kind === 'parent') {
      await message.reply(help.subcommands.map(entry => entry.usage).join('\n'))
    } else {
      await message.reply(help.kind === 'unknown' ? `There is no ${help.query} command.` : 'Nothing to show here.')
    }
  }
}
// #endregion help
