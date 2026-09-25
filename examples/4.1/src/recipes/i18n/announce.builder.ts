import { InteractionContextType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { t } from '@src/recipes/i18n/i18n'

// #region builder
// Discord shows the command's name and description in each member's language
@CommandBuilder(CommandType.SLASH)
export class AnnounceCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setNameLocalizations(t.localizations('announce.name'))
      .setDescription(t.default('announce.description'))
      .setDescriptionLocalizations(t.localizations('announce.description'))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .setContexts(InteractionContextType.Guild)
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription(t.default('announce.message'))
          .setDescriptionLocalizations(t.localizations('announce.message'))
          .setRequired(true),
      )
  }
}
// #endregion builder
