import { describe, expect, it } from 'vitest'
import { loadSettings } from '@src/services/settings/settings'

// #region spec
describe('loadSettings', () => {
  it('reads the environment, with defaults for what is optional', () => {
    expect(loadSettings({ REPORT_CHANNEL_ID: '123456789012345678' })).toEqual({
      reportChannelId: '123456789012345678',
      supportUrl: 'https://example.com/support',
    })
  })

  it('names each value that is missing or malformed', () => {
    expect(() => loadSettings({ SUPPORT_URL: 'not a url' })).toThrow(/REPORT_CHANNEL_ID[\s\S]*SUPPORT_URL/)
  })
})
// #endregion spec
