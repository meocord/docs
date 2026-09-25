// #region app
import { GatewayIntentBits, Partials } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { WelcomeController } from '@src/controllers/event/welcome.controller'
import { KeywordMessageController } from '@src/controllers/message/keyword.message.controller'
import { StarReactionController } from '@src/controllers/reaction/star.reaction.controller'
import { ReminderScheduler } from '@src/services/reminder.scheduler'

@MeoCord({
  controllers: [KeywordMessageController, StarReactionController, WelcomeController],
  services: [ReminderScheduler],
  clientOptions: {
    intents: [
      GatewayIntentBits.Guilds,
      // Messages, and their content, for @MessageHandler
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      // Reactions for @ReactionHandler, with the partials for messages sent before the bot started
      GatewayIntentBits.GuildMessageReactions,
      // guildMemberAdd, for @On in WelcomeController
      GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.Message, Partials.Reaction],
  },
})
export default class App {}
// #endregion app
