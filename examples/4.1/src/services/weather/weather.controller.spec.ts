import { ChatInputCommandInteraction } from 'discord.js'
import { createChatInputOptions, createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { WeatherController } from '@src/services/weather/weather.controller'
import { weatherProviders } from '@src/services/weather/weather.providers'
import {
  FixedWeatherSource,
  HttpWeatherSource,
  WEATHER_SETTINGS,
  WeatherSource,
} from '@src/services/weather/weather.source'

// #region spec
describe('WeatherController', () => {
  // The testing module takes providers in the same shapes as the app
  const module = MeoCordTestingModule.create({
    controllers: [WeatherController],
    providers: [
      { provide: WEATHER_SETTINGS, useValue: { apiUrl: '', units: 'imperial' } },
      { provide: WeatherSource, useClass: FixedWeatherSource },
    ],
  }).compile()

  it('reports in the units the settings name, from whichever source is provided', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction, {
      options: createChatInputOptions({ city: 'Bandung' }),
    })

    await module.invoke(WeatherController, 'show', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Bandung: 21°F' })
    expect(module.get(WEATHER_SETTINGS).units).toBe('imperial')
  })
})
// #endregion spec

// #region factory
describe('weatherProviders', () => {
  it('picks the HTTP source when an API is configured, and the fixed one otherwise', () => {
    const [, source] = weatherProviders
    if (!('useFactory' in source)) throw new Error('expected a factory provider')

    expect(source.useFactory({ apiUrl: 'https://weather.example', units: 'metric' })).toBeInstanceOf(HttpWeatherSource)
    expect(source.useFactory({ apiUrl: '', units: 'metric' })).toBeInstanceOf(FixedWeatherSource)
  })
})
// #endregion factory

// #region missing
describe('a token nothing provides', () => {
  it('stops compile, naming the class and the token', () => {
    expect(() => MeoCordTestingModule.create({ controllers: [WeatherController] }).compile()).toThrow(
      "WeatherService injects Symbol(WeatherSettings), which nothing provides: add a provider for it to the testing module's providers.",
    )
  })
})
// #endregion missing
