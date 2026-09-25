import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@CommandBuilder(CommandType.SLASH)
export class RolesCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Choose your roles')
      .setContexts(InteractionContextType.Guild)
  }
}
