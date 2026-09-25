import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { FeedbackController } from '@src/tutorial/feedback.controller'
import { FeedbackPresenter } from '@src/tutorial/feedback.presenter'
import { ReviewController } from '@src/tutorial/review.controller'

// #region app
@MeoCord({
  controllers: [FeedbackController, ReviewController],
  // Guilds is all it needs: interactions arrive without further intents, and DMs are sent, not read
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  presenter: FeedbackPresenter,
})
export default class App {}
// #endregion app
