import { Args, Command } from '@sapphire/framework'
import { type Message } from 'discord.js'

// #region command
// A message command reads its words one at a time from Args, by type
export class RollCommand extends Command {
  constructor(context: Command.LoaderContext, options: Command.Options) {
    super(context, { ...options, description: 'Rolls a die' })
  }

  override async messageRun(message: Message, args: Args) {
    const sides = await args.pick('integer')
    const note = await args.rest('string').catch(() => '')
    const result = 1 + Math.floor(Math.random() * sides)
    await message.reply(note ? `${result} (${note})` : String(result))
  }
}
// #endregion command
