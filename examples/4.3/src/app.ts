// #region app
import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller'

@MeoCord({
  controllers: [GreetingSlashController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
