import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class SayCommandBuilder {
  build(commandName: string) {
    return (
      new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Post a message as the bot')
        // Who sees the command by default; a server's admins can change it
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
          option.setName('message').setDescription('What to post').setMaxLength(2000).setRequired(true),
        )
    )
  }
}
// #endregion builder
