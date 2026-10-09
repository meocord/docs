import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class GreetingCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Greets someone')
      .addStringOption(option => option.setName('name').setDescription('Who to greet').setRequired(true))
  }
}
// #endregion builder
