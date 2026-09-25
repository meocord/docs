import {
  ApplicationCommandOptionType,
  BaseInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  DiscordAPIError,
} from 'discord.js'
import { createChatInputOptions, createDiscordError, createMockInteraction } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

describe('mock interactions', () => {
  // #region interaction
  it('behave like the real class', async () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)

    // instanceof holds at every level, and type guards run discord.js's own logic
    expect(interaction).toBeInstanceOf(BaseInteraction)
    expect(interaction.isChatInputCommand()).toBe(true)
    expect(interaction.isButton()).toBe(false)

    // Replying twice throws, as it does against Discord
    await interaction.reply({ content: 'hi' })
    expect(interaction.replied).toBe(true)
    await expect(interaction.reply({ content: 'again' })).rejects.toThrow()

    // Every method is still a mock function
    expect(interaction.reply).toHaveBeenCalledWith({ content: 'hi' })
  })
  // #endregion interaction

  // #region options
  it('take options as Discord sends them', () => {
    const interaction = createMockInteraction(ChatInputCommandInteraction)
    interaction.options = createChatInputOptions({
      subcommandGroup: 'admin',
      subcommand: 'ban',
      reason: 'spam',
      days: 7,
    })

    expect(interaction.options.getSubcommand(true)).toBe('ban')
    expect(interaction.options.getString('reason')).toBe('spam')
    // The wrong type answers null, and a required option that is absent throws
    expect(interaction.options.getString('days')).toBeNull()
    expect(() => interaction.options.getNumber('missing', true)).toThrow()
    // data is nested under the subcommand path, as MeoCord reads it to build a handler's params
    expect(interaction.options.data[0]).toMatchObject({
      name: 'admin',
      type: ApplicationCommandOptionType.SubcommandGroup,
    })
  })
  // #endregion options

  // #region errors
  it('reject with the errors discord.js throws', async () => {
    const interaction = createMockInteraction(ButtonInteraction, { customId: 'late' })
    // 10062: the three seconds to answer passed
    interaction.deferUpdate.mockRejectedValue(createDiscordError(10062))

    await expect(interaction.deferUpdate()).rejects.toBeInstanceOf(DiscordAPIError)
    await expect(interaction.deferUpdate()).rejects.toMatchObject({ code: 10062 })
  })
  // #endregion errors
})
