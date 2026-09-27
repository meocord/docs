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
    return (
      new SlashCommandBuilder()
        .setName(commandName)
        // #region step:localisation
        .setNameLocalizations(t.localizations('feedback.name'))
        // #endregion step:localisation
        // before:localisation .setDescription('Send feedback to the staff')
        // #region step:localisation
        .setDescription(t.default('feedback.description'))
        .setDescriptionLocalizations(t.localizations('feedback.description'))
        // #endregion step:localisation
        .setContexts(InteractionContextType.Guild)
    )
  }
}
// #endregion builder
