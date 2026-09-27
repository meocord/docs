import { InteractionContextType, SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

// #region builder
@CommandBuilder(CommandType.SLASH)
export class FeedbackCommandBuilder {
  build(commandName: string) {
    // before:localisation return new SlashCommandBuilder()
    // before:localisation   .setName(commandName)
    // before:localisation   .setDescription('Send feedback to the staff')
    // before:localisation   .setContexts(InteractionContextType.Guild)
    // #region step:localisation
    return new SlashCommandBuilder()
      .setName(commandName)
      .setNameLocalizations(t.localizations('feedback.name'))
      .setDescription(t.default('feedback.description'))
      .setDescriptionLocalizations(t.localizations('feedback.description'))
      .setContexts(InteractionContextType.Guild)
    // #endregion step:localisation
  }
}
// #endregion builder
