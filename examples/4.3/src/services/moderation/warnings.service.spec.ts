import { Guild, Locale } from 'discord.js'
import { Translator } from 'meocord/common'
import { createMockInteraction, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { t } from '@src/i18n'
import { WarningsService } from '@src/services/moderation/warnings.service'

// #region spec
describe('WarningsService', () => {
  const module = MeoCordTestingModule.create({
    providers: [
      { provide: WarningsService, useClass: WarningsService },
      { provide: Translator, useValue: t },
    ],
  }).compile()

  it('writes a notice in the server’s language', () => {
    const guild = createMockInteraction(Guild, { preferredLocale: Locale.Indonesian })

    expect(module.get(WarningsService).notice(guild, 'ada', 2)).toBe('ada punya 2 peringatan')
  })
})
// #endregion spec
