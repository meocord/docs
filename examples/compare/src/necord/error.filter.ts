import { type ArgumentsHost, Catch, type ExceptionFilter } from '@nestjs/common'
import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { NecordArgumentsHost } from 'necord'

// #region filter
// A Nest exception filter, applied with @UseFilters or globally, reads the interaction from Necord's host
@Catch()
export class CommandErrorFilter implements ExceptionFilter {
  async catch(error: unknown, host: ArgumentsHost) {
    const [interaction] = NecordArgumentsHost.create(host).getContext<[ChatInputCommandInteraction]>()
    console.error(error)
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: 'Something went wrong.', flags: MessageFlags.Ephemeral })
    }
  }
}
// #endregion filter
