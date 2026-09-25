import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class SearchCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Search the catalog')
      .addStringOption(option =>
        // setAutocomplete(true) is what makes Discord send the autocomplete interaction
        option.setName('query').setDescription('What to look for').setRequired(true).setAutocomplete(true),
      )
  }
}
// #endregion builder
