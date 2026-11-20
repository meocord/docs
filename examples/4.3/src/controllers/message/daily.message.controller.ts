import { type Message } from 'discord.js'
import { Controller, Cooldown, MessageHandler } from 'meocord/decorator'

// #region controller
@Controller()
export class DailyMessageController {
  // !daily once a day per member; retrying before then is refused by the cooldown
  @MessageHandler('daily')
  @Cooldown({ uses: 1, seconds: 24 * 60 * 60 })
  async daily(message: Message) {
    await message.reply('You claimed 100 coins. Come back tomorrow.')
  }

  // !leaderboard reads a store that can fail; the error reaches the fallback
  @MessageHandler('leaderboard')
  async leaderboard(message: Message) {
    const top = await fetchTopMembers()
    await message.reply(top.join('\n'))
  }
}
// #endregion controller

async function fetchTopMembers(): Promise<string[]> {
  throw new Error('The leaderboard store is down')
}
