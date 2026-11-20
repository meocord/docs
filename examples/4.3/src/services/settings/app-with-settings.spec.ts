import { ChatInputCommandInteraction } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '@src/app-with-settings'
import { ReportController } from '@src/services/settings/report.controller'
import { settingsProvider } from '@src/services/settings/settings'

// Every controller resolved through the container, with the app's real providers
describe('the app with settings', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('resolves its controllers from the environment and answers with the setting', async () => {
    vi.stubEnv('REPORT_CHANNEL_ID', '123456789012345678')
    const module = MeoCordTestingModule.create({
      app: App,
      controllers: [ReportController],
      providers: [settingsProvider],
    }).compile()
    const interaction = createMockInteraction(ChatInputCommandInteraction, { commandName: 'report' })

    await module.dispatch(interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Reports go to <#123456789012345678>.' })
  })

  it('refuses to build without the environment, naming the missing value', () => {
    vi.stubEnv('REPORT_CHANNEL_ID', '')
    expect(() =>
      MeoCordTestingModule.create({ app: App, controllers: [ReportController], providers: [settingsProvider] })
        .compile()
        .get(ReportController),
    ).toThrow(/REPORT_CHANNEL_ID/)
  })
})
