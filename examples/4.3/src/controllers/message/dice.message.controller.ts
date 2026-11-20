import { type Message } from 'discord.js'
import { Controller, MessageHandler, Validate } from 'meocord/decorator'
import { z } from 'zod'

@Controller()
export class DiceMessageController {
  // #region pattern
  // !roll 20 for initiative  gives  { sides: 20, note: 'for initiative' }
  @MessageHandler('roll {sides} {note...?}')
  @Validate(z.object({ sides: z.coerce.number().int().min(2).max(100), note: z.string().optional() }))
  async roll(message: Message, { sides, note }: { sides: number; note?: string }) {
    const result = 1 + Math.floor(Math.random() * sides)
    await message.reply(note ? `${result} (${note})` : String(result))
  }
  // #endregion pattern

  // #region prefixes
  // ?coin or ??coin, and @Bot coin: its own prefixes replace the app's
  @MessageHandler('coin', { prefix: ['?', '??'] })
  async coin(message: Message) {
    await message.reply(Math.random() < 0.5 ? 'Heads' : 'Tails')
  }

  // good morning, as typed, in any case: no prefix at all
  @MessageHandler('good morning', { prefix: false })
  async greet(message: Message) {
    await message.react('☀️')
  }
  // #endregion prefixes
}
