import { type ChatInputCommandErrorPayload, Events, Listener } from '@sapphire/framework'
import { MessageFlags } from 'discord.js'

// #region listener
// An error a command throws is an event; a listener for it decides what the member is told
export class ChatInputCommandError extends Listener<typeof Events.ChatInputCommandError> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.ChatInputCommandError })
  }

  override async run(error: unknown, { interaction }: ChatInputCommandErrorPayload) {
    this.container.logger.error(error)
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral })
    }
  }
}
// #endregion listener
