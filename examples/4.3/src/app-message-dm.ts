// #region app
import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { DailyMessageController } from '@src/controllers/message/daily.message.controller'

@MeoCord({
  controllers: [DailyMessageController],
  clientOptions: {
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  },
  messages: {
    prefix: '!',
    // DM the author an error no filter handled, naming the command, channel and server
    dmOnError: true,
    // DM the author how long a cooldown asks them to wait, once per wait
    dmOnCooldown: true,
  },
})
export default class App {}
// #endregion app
