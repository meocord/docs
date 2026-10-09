// #region controller
import { type Message } from 'discord.js'
import { Controller, MessageHandler } from 'meocord/decorator'

@Controller()
export class KeywordMessageController {
  private seen = 0

  // !ping, with the app's prefix, in any case: the whole message, word for word
  @MessageHandler('ping')
  async ping(message: Message) {
    await message.reply('Pong!')
  }

  // Runs for every message, after the one patterned handler it matched, if any
  @MessageHandler()
  count() {
    this.seen += 1
  }

  get messagesSeen() {
    return this.seen
  }
}
// #endregion controller
