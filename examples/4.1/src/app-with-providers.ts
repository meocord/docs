import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { WeatherController } from '@src/services/weather/weather.controller'
import { weatherProviders } from '@src/services/weather/weather.providers'

// #region app
@MeoCord({
  controllers: [WeatherController],
  providers: weatherProviders,
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
