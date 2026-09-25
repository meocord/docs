import { ChatInputCommandInteraction, Locale, User } from 'discord.js'
import {
  createChatInputOptions,
  createMockInteraction,
  expectCompleteCatalog,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { WarnSlashController } from '@src/controllers/slash/warn.slash.controller'
import { t } from '@src/i18n'

describe('WarnSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [WarnSlashController] }).compile()

  it('answers in the language of the user who ran it', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction, { locale: Locale.Indonesian })
    interaction.options = createChatInputOptions({ member: createMockInteraction(User, { username: 'ada' }) })

    await module.invoke(WarnSlashController, 'warn', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'ada diberi peringatan.' })
  })

  // #region complete
  it('has every message and plural form in every locale', () => {
    expectCompleteCatalog(t)
  })
  // #endregion complete

  it('picks the plural form for the count, per language', () => {
    expect(t.locale(Locale.EnglishUS)('warnings', { user: 'ada', count: 1 })).toBe('ada has 1 warning')
    expect(t.locale(Locale.EnglishGB)('warnings', { user: 'ada', count: 3 })).toBe('ada has 3 warnings')
  })
})
