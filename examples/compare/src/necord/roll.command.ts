import { Injectable } from '@nestjs/common'
import { Arguments, Context, TextCommand, type TextCommandContext } from 'necord'

// #region command
// A text command receives its words as strings; the prefix is NecordModule's `prefix` option
@Injectable()
export class RollCommand {
  @TextCommand({ name: 'roll', description: 'Rolls a die' })
  async roll(@Context() [message]: TextCommandContext, @Arguments() words: string[]) {
    const sides = Number(words[0])
    if (!Number.isInteger(sides) || sides < 2) return message.reply('Usage: !roll <sides> [note]')
    const note = words.slice(1).join(' ')
    const result = 1 + Math.floor(Math.random() * sides)
    return message.reply(note ? `${result} (${note})` : String(result))
  }
}
// #endregion command
