import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { CardButtonController } from '@src/controllers/button/card.button.controller'
import { BrandPresenter } from '@src/presenters/brand.presenter'

// #region app
@MeoCord({
  controllers: [CardButtonController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  presenter: BrandPresenter,
})
export default class App {}
// #endregion app
