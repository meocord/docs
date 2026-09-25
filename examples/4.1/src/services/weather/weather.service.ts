import { Inject, Service } from 'meocord/decorator'
import { WEATHER_SETTINGS, type WeatherSettings, WeatherSource } from '@src/services/weather/weather.source'

// #region service
@Service()
export class WeatherService {
  constructor(
    // By its type, the abstract class; the provider decides which implementation arrives
    private readonly source: WeatherSource,
    // By its token, a value
    @Inject(WEATHER_SETTINGS) private readonly settings: WeatherSettings,
  ) {}

  async report(city: string): Promise<string> {
    const unit = this.settings.units === 'metric' ? '°C' : '°F'
    return `${city}: ${await this.source.temperature(city)}${unit}`
  }
}
// #endregion service
