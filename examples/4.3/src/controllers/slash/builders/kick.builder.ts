import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@CommandBuilder(CommandType.SLASH)
export class KickCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Kick a member')
      .addUserOption(option => option.setName('target').setDescription('Who to kick').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Why'))
  }
}
