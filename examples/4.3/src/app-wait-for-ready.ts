import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { PriceSlashController } from '@src/services/prices/price.slash.controller'

// #region app
@MeoCord({
  controllers: [PriceSlashController],
  // Each call waits for the onReady hooks of the classes it uses
  waitForReady: true,
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
