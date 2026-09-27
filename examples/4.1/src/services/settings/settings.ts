import { createToken } from 'meocord/common'
import { Inject, Service } from 'meocord/decorator'
import { type Provider } from 'meocord/interface'
import { z } from 'zod'

// #region settings
// What the bot reads from the environment, each value checked
const Env = z.object({
  REPORT_CHANNEL_ID: z.string().regex(/^\d{17,20}$/, 'must be a channel ID'),
  SUPPORT_URL: z.url().default('https://example.com/support'),
})

export interface Settings {
  reportChannelId: string
  supportUrl: string
}

export const SETTINGS = createToken<Settings>('Settings')

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const result = Env.safeParse(env)
  if (!result.success) throw new Error(`The environment is incomplete:\n${z.prettifyError(result.error)}`)
  return { reportChannelId: result.data.REPORT_CHANNEL_ID, supportUrl: result.data.SUPPORT_URL }
}

// Made once, before the bot logs in, so a missing value stops it at startup rather than at the first call
export const settingsProvider: Provider = { provide: SETTINGS, useFactory: () => loadSettings() }
// #endregion settings

// #region inject
@Service()
export class ReportService {
  constructor(@Inject(SETTINGS) private readonly settings: Settings) {}

  channelId(): string {
    return this.settings.reportChannelId
  }
}
// #endregion inject
