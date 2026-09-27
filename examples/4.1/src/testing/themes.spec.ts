import { ButtonInteraction, resolveColor } from 'discord.js'
import { respond, useTheme } from 'meocord/common'
import { Command, Controller, MeoCord, Service } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { createMockInteraction, createMockTheme, getResponse, MeoCordTestingModule, withTheme } from 'meocord/testing'
import { describe, expect, it, vi } from 'vitest'

@Service()
class Receipts {
  paid(amount: number) {
    return `${useTheme().emojis.success} Paid ${amount} coins`
  }
}

@Controller()
class ShopController {
  constructor(private readonly receipts: Receipts) {}

  @Command('shop/buy', CommandType.BUTTON)
  async buy(interaction: ButtonInteraction) {
    await respond(interaction).send({ embeds: [{ description: this.receipts.paid(5) }] })
  }
}

@MeoCord({
  controllers: [ShopController],
  clientOptions: { intents: [] },
  theme: { colors: { primary: '#5865F2' } },
  themeFor: { guild: () => undefined },
})
class ShopApp {}

const colourOf = (click: ButtonInteraction) =>
  (getResponse(click).calls[0].payload as { embeds: { color?: number }[] }).embeds[0].color

describe('testing themes', () => {
  // #region override-theme
  it('changes one token of the app’s theme for one module', async () => {
    const module = MeoCordTestingModule.create({ app: ShopApp, controllers: [ShopController] })
      .overrideTheme({ colors: { primary: '#E3606D' } })
      .compile()
    const click = createMockInteraction(ButtonInteraction, { customId: 'shop/buy' })

    await module.invoke(ShopController, 'buy', click)

    expect(colourOf(click)).toBe(resolveColor('#E3606D'))
  })
  // #endregion override-theme

  // #region theme-for
  it('looks a server’s theme up once, until the module’s cache is cleared', async () => {
    const guild = vi.fn(() => ({ colors: { primary: '#26A042' } }) as const)
    const module = MeoCordTestingModule.create({ app: ShopApp, controllers: [ShopController] })
      .overrideThemeFor({ guild })
      .compile()
    const click = () =>
      createMockInteraction(ButtonInteraction, { customId: 'shop/buy', guildId: '100000000000000001' })

    await module.dispatch(click())
    await module.dispatch(click())
    module.themeCache.invalidateGuild('100000000000000001')
    await module.dispatch(click())

    expect(guild).toHaveBeenCalledTimes(2)
  })
  // #endregion theme-for

  // #region mock-theme
  it('runs a service in a theme, with no module', () => {
    const theme = createMockTheme({ emojis: { success: '🎉' } })

    const line = withTheme(theme, () => new Receipts().paid(5))

    expect(line).toBe('🎉 Paid 5 coins')
  })
  // #endregion mock-theme
})
