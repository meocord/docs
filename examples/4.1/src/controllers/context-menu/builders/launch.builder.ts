import { ApplicationCommandType, EntryPointCommandHandlerType } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
@CommandBuilder(CommandType.PRIMARY_ENTRY_POINT)
export class LaunchCommandBuilder {
  build(commandName: string) {
    return {
      type: ApplicationCommandType.PrimaryEntryPoint as const,
      name: commandName,
      description: 'Launch the activity',
      // What makes Discord send the interaction to the bot at all
      handler: EntryPointCommandHandlerType.AppHandler,
    }
  }
}
// #endregion builder
