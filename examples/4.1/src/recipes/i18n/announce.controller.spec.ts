import { ChatInputCommandInteraction, Guild, GuildMember, Locale, TextChannel, User } from 'discord.js'
import {
  createChatInputOptions,
  createMockInteraction,
  expectCompleteCatalog,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { AnnounceController } from '@src/recipes/i18n/announce.controller'
import { t } from '@src/recipes/i18n/i18n'

// #region spec
describe('AnnounceController', () => {
  const module = MeoCordTestingModule.create({ controllers: [AnnounceController] }).compile()

  it('announces in the server’s language, and confirms in the author’s', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction, {
      locale: Locale.Indonesian,
      guildLocale: Locale.EnglishUS,
      options: createChatInputOptions({ message: 'Maintenance at 20:00.' }),
    })

    await module.invoke(AnnounceController, 'announce', interaction)

    const [announcement, confirmation] = getResponse(interaction).calls
    expect(announcement.payload).toMatchObject({ content: '**📣 Announcement**\nMaintenance at 20:00.' })
    expect(confirmation.payload).toMatchObject({ content: 'Terkirim. Semua orang melihatnya dalam bahasa server.' })
  })

  it('welcomes a new member in the server’s language', async () => {
    const systemChannel = createMockInteraction(TextChannel)
    const guild = createMockInteraction(Guild, {
      name: 'Kafe Kucing',
      preferredLocale: Locale.Indonesian,
      systemChannel,
    })
    // discord.js's own toString() mentions the member through its user
    const member = createMockInteraction(GuildMember, { guild, user: createMockInteraction(User, { id: '111' }) })

    await module.emit('guildMemberAdd', member)

    expect(systemChannel.send).toHaveBeenCalledWith({ content: 'Selamat datang di Kafe Kucing, <@111>!' })
  })

  it('has every message in every language', () => {
    expectCompleteCatalog(t)
  })
})
// #endregion spec
