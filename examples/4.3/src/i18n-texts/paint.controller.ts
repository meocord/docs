import { type Message } from 'discord.js'
import { Controller, MessageHandler } from 'meocord/decorator'

@Controller()
export class PaintController {
  @MessageHandler('roll {sides:int}')
  async roll(message: Message, { sides }: { sides: number }) {
    await message.reply(`Rolled ${Math.ceil(Math.random() * sides)}`)
  }

  @MessageHandler('paint {accent:color}')
  async paint(message: Message, { accent }: { accent: number }) {
    await message.reply(`Painted #${accent.toString(16).padStart(6, '0')}`)
  }
}
