import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class TimeoutCommandBuilder {
  build(commandName: string) {
    return (
      new SlashCommandBuilder()
        .setName(commandName)
        .setDescription('Time a member out')
        // Discord shows the command only to members who can time others out, and only in servers
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setContexts(InteractionContextType.Guild)
        .addUserOption(option => option.setName('member').setDescription('Who').setRequired(true))
        .addIntegerOption(option =>
          option.setName('minutes').setDescription('How long').setRequired(true).setMinValue(1).setMaxValue(10080),
        )
        .addStringOption(option => option.setName('reason').setDescription('Why').setMaxLength(200))
    )
  }
}
// #endregion builder
