import { type Provider } from 'meocord/interface'
import {
  FixedWeatherSource,
  HttpWeatherSource,
  WEATHER_SETTINGS,
  type WeatherSettings,
  WeatherSource,
} from '@src/services/weather/weather.source'

// #region providers
export const weatherProviders: Provider[] = [
  // A value, provided as it is
  {
    provide: WEATHER_SETTINGS,
    useValue: { apiUrl: process.env.WEATHER_API_URL ?? '', units: 'metric' } satisfies WeatherSettings,
  },
  // A factory, given what `inject` names, in order: here it picks the source for the settings
  {
    provide: WeatherSource,
    useFactory: (settings: WeatherSettings) =>
      settings.apiUrl ? new HttpWeatherSource(settings) : new FixedWeatherSource(),
    inject: [WEATHER_SETTINGS],
  },
]
// #endregion providers
