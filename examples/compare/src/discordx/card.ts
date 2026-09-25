import { type ButtonInteraction, MessageFlags } from 'discord.js'
import { ButtonComponent, Discord, Guard, type GuardFunction } from 'discordx'

// #region button
// A guard is a function; the id is a regular expression, and the handler reads its parts itself
const OnlyOwner: GuardFunction<ButtonInteraction> = async (interaction, _client, next) => {
  const [, ownerId] = interaction.customId.split('/')
  if (interaction.user.id === ownerId) return next()
  await interaction.reply({ content: 'Only the user who opened this can use it.', flags: MessageFlags.Ephemeral })
}

@Discord()
export class Card {
  @ButtonComponent({ id: /^card\/\d+\/refresh$/ })
  @Guard(OnlyOwner)
  async refresh(interaction: ButtonInteraction) {
    await interaction.update({ content: `Refreshed at ${new Date().toISOString()}` })
  }
}
// #endregion button
