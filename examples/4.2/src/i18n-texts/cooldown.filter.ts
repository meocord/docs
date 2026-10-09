// #region filter
import { MessageFlags } from 'discord.js'
import { CooldownError, type ExecutionContext, translateError, Translator } from 'meocord/common'
import { Catch } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'

@Catch(CooldownError)
export class CooldownFilter implements ExceptionFilter<CooldownError> {
  constructor(private readonly t: Translator) {}

  async catch(error: CooldownError, context: ExecutionContext) {
    const interaction = context.getInteraction()
    // MeoCord's words for the wait, in the user's language, in the app's own answer
    if (interaction?.isRepliable()) {
      await interaction.reply({
        content: `⏳ ${translateError(error, this.t, interaction)}`,
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
// #endregion filter
