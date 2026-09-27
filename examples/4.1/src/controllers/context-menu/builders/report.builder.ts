import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
// A context menu's name is what the menu shows, capitals and spaces included
@CommandBuilder(CommandType.CONTEXT_MENU)
export class ReportUserBuilder {
  build(commandName: string) {
    return new ContextMenuCommandBuilder().setName(commandName).setType(ApplicationCommandType.User)
  }
}
// #endregion builder

@CommandBuilder(CommandType.CONTEXT_MENU)
export class BookmarkBuilder {
  build(commandName: string) {
    return new ContextMenuCommandBuilder().setName(commandName).setType(ApplicationCommandType.Message)
  }
}
