import { Locale } from 'discord.js'
import { CooldownError, translateError } from 'meocord/common'
import { createMockGuild, createMockMessage, expectCompleteCatalog, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import TranslatedApp from '@src/i18n-texts/app'
import { PaintController } from '@src/i18n-texts/paint.controller'
import { t } from '@src/i18n'

describe("MeoCord's own texts", () => {
  const module = MeoCordTestingModule.create({ app: TranslatedApp, controllers: [PaintController] }).compile()
  // #region usage
  const replyTo = async (content: string, preferredLocale?: Locale) => {
    const guild = preferredLocale ? Object.assign(createMockGuild(), { preferredLocale }) : null
    const message = createMockMessage({ content, guild })
    await module.dispatch(message)
    return (message.reply.mock.calls[0][0] as { content: string }).content
  }

  it("answers in the server's language, and each line the catalog lacks in English", async () => {
    expect(await replyTo('!roll lots', Locale.Indonesian)).toBe(
      'Cara pakai: !roll <sides>\nsides: "lots" bukan bilangan bulat yang sah',
    )
    expect(await replyTo('!paint red', Locale.Indonesian)).toBe(
      'Cara pakai: !paint <accent>\naccent: "red" bukan warna hex yang sah',
    )
    expect(await replyTo('!roll 1 2', Locale.Indonesian)).toBe(
      'Cara pakai: !roll <sides>\nThe command has more words than it takes',
    )
  })

  it("answers a direct message in the default locale's language", async () => {
    expect(await replyTo('!paint red')).toBe('Usage: !paint <accent>\naccent: "red" is not a valid hex colour')
  })
  // #endregion usage

  it('gives a filter the text MeoCord would answer with', () => {
    // The wait's end as a Discord timestamp, which Discord words in the reader's language
    expect(translateError(new CooldownError(12_000, 'user'), t, Locale.Indonesian)).toMatch(
      /^Pelan-pelan: coba lagi <t:\d+:R>\.$/,
    )
  })

  // #region complete
  it("names each of MeoCord's texts a locale leaves in English", () => {
    expect(() => expectCompleteCatalog(t, { meocord: true })).toThrow('id: missing meocord.usage.headingMany')
  })
  // #endregion complete
})
