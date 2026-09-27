import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { settingsProvider } from '@src/services/settings/settings'
import { ReportController } from '@src/services/settings/report.controller'

// #region app
@MeoCord({
  controllers: [ReportController],
  providers: [settingsProvider],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
