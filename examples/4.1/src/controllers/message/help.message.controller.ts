// #region help
import { type Message } from 'discord.js'
import { HandlerRegistry } from 'meocord/core'
import { Controller, MessageHandler } from 'meocord/decorator'

@Controller()
export class HelpMessageController {
  constructor(private readonly handlers: HandlerRegistry) {}

  // !help lists the commands; !help mute, or !help m, shows one
  @MessageHandler('help {command...?}', { description: 'Lists the commands, or shows one.' })
  async help(message: Message, { command }: { command?: string }) {
    const commands = this.handlers.list({ kind: 'message' }).filter(entry => entry.command)
    const one = command ? commands.find(entry => entry.matches(command)) : undefined
    if (command && !one) {
      await message.reply(`No command is called ${command}.`)
      return
    }
    const lines = one
      ? [one.usage('!'), one.description, one.aliases.length ? `Also: ${one.aliases.join(', ')}` : undefined]
      : commands.map(entry => `\`${entry.usage('!')}\` ${entry.description ?? ''}`)
    await message.reply(lines.filter(Boolean).join('\n'))
  }
}
// #endregion help
