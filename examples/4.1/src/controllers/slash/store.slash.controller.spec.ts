import { ChatInputCommandInteraction, resolveColor } from 'discord.js'
import { createMockInteraction, createMockTheme, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { StoreSlashController } from '@src/controllers/slash/store.slash.controller'

// #region spec
describe('StoreSlashController', () => {
  const module = MeoCordTestingModule.create({ controllers: [StoreSlashController] })
    // A theme for the module, as @MeoCord({ theme }) gives one; each @UseTheme still goes over it
    .overrideTheme({ emojis: { success: '🎉' } })
    .compile()
  // The embed of the call that sent one: under @Defer, the edit after the deferral
  const embedOf = (interaction: ChatInputCommandInteraction) => {
    type Sent = {
      embeds?: ({ toJSON(): { description?: string; color?: number } } | { description?: string; color?: number })[]
    }
    const sent = getResponse(interaction)
      .calls.map(call => call.payload as Sent)
      .find(payload => payload?.embeds?.length)
    const [embed] = sent!.embeds!
    return 'toJSON' in embed ? embed.toJSON() : embed
  }

  it("writes a receipt with the theme's success emoji and colour", async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)

    await module.invoke(StoreSlashController, 'receipt', interaction)

    expect(embedOf(interaction)).toMatchObject({
      description: '🎉 Paid',
      color: resolveColor(createMockTheme().colors.success),
    })
  })

  it("fills an embed sent with no colour with the handler's primary", async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)

    await module.invoke(StoreSlashController, 'refund', interaction)

    expect(embedOf(interaction).color).toBe(resolveColor('#E3606D'))
  })

  it("leaves the banner's stripe as Discord draws it", async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)

    await module.invoke(StoreSlashController, 'banner', interaction)

    expect(embedOf(interaction).color).toBeUndefined()
  })
})
// #endregion spec
