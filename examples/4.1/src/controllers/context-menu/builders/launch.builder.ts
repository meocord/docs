import { ApplicationCommandType, EntryPointCommandHandlerType } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
@CommandBuilder(CommandType.PRIMARY_ENTRY_POINT)
export class LaunchCommandBuilder {
  build() {
    return {
      type: ApplicationCommandType.PrimaryEntryPoint as const,
      name: 'launch',
      description: 'Launch the activity',
      // What makes Discord send the interaction to the bot at all
      handler: EntryPointCommandHandlerType.AppHandler,
    }
  }
}
// #endregion builder
