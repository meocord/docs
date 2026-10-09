import { ApplicationIntegrationType, ChatInputCommandInteraction, InteractionContextType } from 'discord.js'
import { getInstallContext } from 'meocord/common'
import { createMockInteraction } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

// #region contexts
const at = (context: InteractionContextType, owners?: Partial<Record<ApplicationIntegrationType, string>>) =>
  getInstallContext(
    createMockInteraction(ChatInputCommandInteraction, { context, authorizingIntegrationOwners: owners }),
  )

describe('getInstallContext', () => {
  it('tells the four places a command can run apart', () => {
    // The bot's own server, installed to the server
    expect(
      at(InteractionContextType.Guild, { [ApplicationIntegrationType.GuildInstall]: '876543210987654321' }),
    ).toEqual({
      where: 'guild',
      botInstalled: true,
    })
    // A server without the bot, through a user install
    expect(
      at(InteractionContextType.Guild, { [ApplicationIntegrationType.UserInstall]: '123456789012345678' }),
    ).toEqual({
      where: 'guild',
      botInstalled: false,
    })
    expect(at(InteractionContextType.BotDM)).toEqual({ where: 'bot-dm', botInstalled: true })
    expect(at(InteractionContextType.PrivateChannel)).toEqual({ where: 'private-channel', botInstalled: false })
  })
})
// #endregion contexts
