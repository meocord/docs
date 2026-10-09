import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type CommandBuilderBase } from 'meocord/interface'
import { t } from '@src/i18n'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class WarnCommandBuilder implements CommandBuilderBase {
  build() {
    return new SlashCommandBuilder()
      .setName(t.default('warn.name'))
      .setNameLocalizations(t.localizations('warn.name'))
      .setDescription(t.default('warn.description'))
      .setDescriptionLocalizations(t.localizations('warn.description'))
      .addUserOption(option => option.setName('member').setDescription('Who to warn').setRequired(true))
  }
}
// #endregion builder
