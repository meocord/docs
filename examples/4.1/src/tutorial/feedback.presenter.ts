// #region step:localisation
import { type Locale } from 'discord.js'
// #endregion step:localisation
import { Service } from 'meocord/decorator'
import { type PresentedError, type ResponseContext, type ResponsePresenter, type ResponseView } from 'meocord/interface'
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

// #region presenter
// How the bot looks while it works and when something fails, in the theme's colours
@Service()
export class FeedbackPresenter implements ResponsePresenter {
  // before:localisation loading({ theme }: ResponseContext): ResponseView {
  // before:localisation   return { text: 'Working on it…', emoji: theme.emojis.loading, color: theme.colors.primary }
  // before:localisation }
  // #region step:localisation
  loading({ locale, theme }: ResponseContext): ResponseView {
    const text = t.locale(locale as Locale)('presenter.loading')
    return { text, emoji: theme.emojis.loading, color: theme.colors.primary }
  }
  // #endregion step:localisation

  // A user's own mistake is a warning, a fault in the bot is danger
  // before:localisation error({ theme }: ResponseContext, { message, tone }: PresentedError): ResponseView {
  // before:localisation   return { title: 'Something went wrong', text: message, color: theme.colors[tone] }
  // before:localisation }
  // #region step:localisation
  error({ locale, theme }: ResponseContext, { message, tone }: PresentedError): ResponseView {
    const title = t.locale(locale as Locale)('presenter.failed')
    return { title, text: message, color: theme.colors[tone] }
  }
  // #endregion step:localisation
}
// #endregion presenter
