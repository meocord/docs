import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@CommandBuilder(CommandType.SLASH)
export class NoteCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Save a note')
      .addStringOption(option => option.setName('text').setDescription('The note').setRequired(true).setMaxLength(500))
  }
}

@CommandBuilder(CommandType.SLASH)
export class NotesCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder().setName(commandName).setDescription('List your notes')
  }
}
