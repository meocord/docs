import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { t } from '@src/tutorial/i18n'

// #region builder
@CommandBuilder(CommandType.SLASH)
export class FeedbackCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setNameLocalizations(t.localizations('feedback.name'))
      .setDescription(t.default('feedback.description'))
      .setDescriptionLocalizations(t.localizations('feedback.description'))
      .setContexts(InteractionContextType.Guild)
  }
}
// #endregion builder
