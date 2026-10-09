import { Locale } from 'discord.js'
import { expectCompleteCatalog } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { t } from '@src/tutorial/i18n'

// #region spec
describe('the feedback bot’s catalogs', () => {
  it('has every message in every language', () => {
    expectCompleteCatalog(t)
  })

  it('names the command in each language Discord shows it in', () => {
    expect(t.localizations('feedback.name')).toMatchObject({ [Locale.Indonesian]: 'masukan' })
  })
})
// #endregion spec
