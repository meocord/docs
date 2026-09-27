import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { settingsProvider } from '@src/services/settings/settings'
import { WeatherController } from '@src/services/weather/weather.controller'

// #region app
@MeoCord({
  controllers: [WeatherController],
  providers: [settingsProvider],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
