// #region app
import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { EconomyMessageController } from '@src/controllers/message/economy.message.controller'
import { HelpMessageController } from '@src/controllers/message/help.message.controller'
import { ModerationMessageController } from '@src/controllers/message/moderation.message.controller'
import { color } from '@src/message-types'

@MeoCord({
  controllers: [EconomyMessageController, ModerationMessageController, HelpMessageController],
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
  },
})
export default class App {}
// #endregion app
