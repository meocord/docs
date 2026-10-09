import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class SettingsCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Change your settings')
      .addSubcommandGroup(group =>
        group
          .setName('notify')
          .setDescription('Notifications')
          .addSubcommand(subcommand =>
            subcommand
              .setName('email')
              .setDescription('Email notifications')
              .addBooleanOption(option => option.setName('enabled').setDescription('On or off').setRequired(true)),
          ),
      )
  }
}
// #endregion builder
