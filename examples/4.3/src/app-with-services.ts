import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller'
import { StatusService } from '@src/services/status.service'

// #region app
@MeoCord({
  controllers: [GreetingSlashController],
  // A controller that injects a service is enough to bind it; list only services nothing injects
  services: [StatusService],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
