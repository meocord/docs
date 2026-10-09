import { createToken } from 'meocord/common'
import { Inject } from 'meocord/decorator'

// #region token
export interface WeatherSettings {
  apiUrl: string
  units: 'metric' | 'imperial'
}

// A value has no class to inject it by, so it gets a token, typed with what it provides
export const WEATHER_SETTINGS = createToken<WeatherSettings>('WeatherSettings')
// #endregion token

// #region source
// An abstract class is a token and a type at once: whatever provides it is injected by the parameter's type
export abstract class WeatherSource {
  abstract temperature(city: string): Promise<number>
}

export class HttpWeatherSource extends WeatherSource {
  constructor(@Inject(WEATHER_SETTINGS) private readonly settings: WeatherSettings) {
    super()
  }

  async temperature(city: string): Promise<number> {
    const url = `${this.settings.apiUrl}?city=${encodeURIComponent(city)}&units=${this.settings.units}`
    const body = (await (await fetch(url)).json()) as { temperature: number }
    return body.temperature
  }
}

// Every city at the same temperature: for development without an API, and for tests
export class FixedWeatherSource extends WeatherSource {
  async temperature(): Promise<number> {
    return 21
  }
}
// #endregion source
