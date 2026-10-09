import { GatewayIntentBits } from 'discord.js'
// #region step:reactions
import { Partials } from 'discord.js'
// #endregion step:reactions
import { MeoCord } from 'meocord/decorator'
// #region step:lifecycle-hooks
import { ActivityService } from '@src/tutorial/activity.service'
// #endregion step:lifecycle-hooks
import { FeedbackController } from '@src/tutorial/feedback.controller'
// #region step:message-commands
import { FeedbackMessageController } from '@src/tutorial/feedback.message.controller'
// #endregion step:message-commands
// #region step:presenters
import { FeedbackPresenter } from '@src/tutorial/feedback.presenter'
// #endregion step:presenters
import { ReviewController } from '@src/tutorial/review.controller'
// #region step:reactions
import { ReviewReactionController } from '@src/tutorial/review.reaction.controller'
// #endregion step:reactions
// #region step:gateway-events
import { WelcomeController } from '@src/tutorial/welcome.controller'
// #endregion step:gateway-events

// #region app
@MeoCord({
  controllers: [
    // The slash command and its form, and the review buttons
    FeedbackController,
    ReviewController,
    // #region step:message-commands
    FeedbackMessageController,
    // #endregion step:message-commands
    // #region step:reactions
    ReviewReactionController,
    // #endregion step:reactions
    // #region step:gateway-events
    WelcomeController,
    // #endregion step:gateway-events
  ],
  // #region step:lifecycle-hooks
  services: [ActivityService],
  // #endregion step:lifecycle-hooks
  clientOptions: {
    intents: [
      // Interactions arrive with Guilds alone, and DMs are sent, not read
      GatewayIntentBits.Guilds,
      // #region step:message-commands
      // Messages in servers; a mention of the bot carries its text without MessageContent
      GatewayIntentBits.GuildMessages,
      // #endregion step:message-commands
      // #region step:reactions
      GatewayIntentBits.GuildMessageReactions,
      // #endregion step:reactions
    ],
    // #region step:reactions
    // So reactions to messages sent before the bot started still arrive
    partials: [Partials.Message, Partials.Reaction],
    // #endregion step:reactions
  },
  // #region step:message-commands
  // A message command starts with a mention of the bot, never a prefix
  messages: { mention: 'only' },
  // #endregion step:message-commands
  // #region step:presenters
  presenter: FeedbackPresenter,
  // #endregion step:presenters
  // #region step:theming
  // The bot's own colour; every other role keeps MeoCord's default
  theme: { colors: { primary: '#5865F2' } },
  // #endregion step:theming
})
export default class App {}
// #endregion app
