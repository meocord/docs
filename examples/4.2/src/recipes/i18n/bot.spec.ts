import { ChatInputCommandInteraction, Guild, GuildMember, Locale, TextChannel } from 'discord.js'
import {
  createChatInputOptions,
  createMockInteraction,
  createMockUser,
  expectCompleteCatalog,
  getResponse,
  MeoCordTestingModule,
} from 'meocord/testing'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AnnounceApp, { AnnounceController, t } from '@src/recipes/i18n/bot'

// An Indonesian-speaking author in an English-speaking server
const announce = (message: string) =>
  createMockInteraction(ChatInputCommandInteraction, {
    commandName: 'announce',
    locale: Locale.Indonesian,
    guildId: '1',
    guild: createMockInteraction(Guild, { id: '1', preferredLocale: Locale.EnglishUS }),
    guildLocale: Locale.EnglishUS,
    options: createChatInputOptions({ message }),
  })

// #region spec
describe('AnnounceApp', () => {
  afterEach(() => vi.useRealTimers())

  it('announces in the server’s language, and confirms in the author’s', async () => {
    const module = MeoCordTestingModule.create({ controllers: [AnnounceController] }).compile()
    const interaction = announce('Maintenance at 20:00.')

    await module.invoke(AnnounceController, 'announce', interaction)

    const [announcement, confirmation] = getResponse(interaction).calls
    expect(announcement.payload).toMatchObject({ content: '**📣 Announcement**\nMaintenance at 20:00.' })
    expect(confirmation.payload).toMatchObject({ content: 'Terkirim. Semua orang melihatnya dalam bahasa server.' })
  })

  it('tells the author how long to wait, in their language, through MeoCord’s own text', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const module = MeoCordTestingModule.fromApp(AnnounceApp).compile()

    await module.dispatch(announce('Maintenance at 20:00.'))
    vi.advanceTimersByTime(15_000)
    const again = announce('And again.')
    await module.dispatch(again)

    // The presenter shows it as an embed, its title translated too
    expect(getResponse(again).calls[0].payload).toMatchObject({
      embeds: [
        { title: 'Ups!', description: `Pelan-pelan: coba lagi <t:${Math.ceil((Date.now() + 45_000) / 1000)}:R>.` },
      ],
    })
    expect(again.ephemeral).toBe(true)
  })

  it('welcomes a new member in the server’s language', async () => {
    const module = MeoCordTestingModule.create({ controllers: [AnnounceController] }).compile()
    const systemChannel = createMockInteraction(TextChannel)
    const guild = createMockInteraction(Guild, {
      name: 'Kafe Kucing',
      preferredLocale: Locale.Indonesian,
      systemChannel,
    })
    // discord.js's own toString() mentions the member through its user
    const member = createMockInteraction(GuildMember, { guild, user: createMockUser({ id: '111' }) })

    await module.emit('guildMemberAdd', member)

    expect(systemChannel.send).toHaveBeenCalledWith({ content: 'Selamat datang di Kafe Kucing, <@111>!' })
  })

  it('has every message in every language, MeoCord’s own included', () => {
    expectCompleteCatalog(t, { meocord: true })
  })
})
// #endregion spec
