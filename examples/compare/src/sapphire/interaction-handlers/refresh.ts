import { InteractionHandler, InteractionHandlerTypes } from '@sapphire/framework'
import { type ButtonInteraction, MessageFlags } from 'discord.js'

// #region button
// An interaction handler decides in parse() whether a button is its own, and what to pass to run()
export class RefreshHandler extends InteractionHandler {
  constructor(context: InteractionHandler.LoaderContext, options: InteractionHandler.Options) {
    super(context, { ...options, interactionHandlerType: InteractionHandlerTypes.Button })
  }

  override parse(interaction: ButtonInteraction) {
    const [scope, ownerId, action] = interaction.customId.split('/')
    if (scope !== 'card' || action !== 'refresh') return this.none()
    return this.some({ ownerId })
  }

  override async run(interaction: ButtonInteraction, { ownerId }: InteractionHandler.ParseResult<this>) {
    // Preconditions guard commands; a handler checks for itself
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: 'Only the user who opened this can use it.', flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.update({ content: `Refreshed at ${new Date().toISOString()}` })
  }
}
// #endregion button
