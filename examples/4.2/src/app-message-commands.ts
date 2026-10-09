// #region app
import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { EconomyMessageController } from '@src/controllers/message/economy.message.controller'
import { ModerationMessageController } from '@src/controllers/message/moderation.message.controller'
import { color } from '@src/message-types'

@MeoCord({
  controllers: [EconomyMessageController, ModerationMessageController],
  clientOptions: {
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  },
  messages: {
    prefix: '!',
    mention: true,
    // The app's own param types, used in patterns as {name:color}
    types: { color },
    // How long a usage reply stays, in seconds; 0 keeps it
    deleteUsageRepliesAfter: 10,
    // A built-in !help, listing the commands a caller can use
    help: true,
  },
})
export default class App {}
// #endregion app
