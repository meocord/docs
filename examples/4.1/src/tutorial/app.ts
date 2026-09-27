import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { FeedbackController } from '@src/tutorial/feedback.controller'
// #region step:presenters
import { FeedbackPresenter } from '@src/tutorial/feedback.presenter'
// #endregion step:presenters
import { ReviewController } from '@src/tutorial/review.controller'

// #region app
@MeoCord({
  controllers: [FeedbackController, ReviewController],
  // Guilds is all it needs: interactions arrive without further intents, and DMs are sent, not read
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
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
