// #region controller
import { type Message } from 'discord.js'
import { Controller, MessageHandler } from 'meocord/decorator'

@Controller()
export class KeywordMessageController {
  private seen = 0

  // Runs when a message's whole content, trimmed, is exactly `!ping`
  @MessageHandler('!ping')
  async ping(message: Message) {
    await message.reply('Pong!')
  }

  // Runs for every message, after the keyword handlers
  @MessageHandler()
  count() {
    this.seen += 1
  }

  get messagesSeen() {
    return this.seen
  }
}
// #endregion controller
