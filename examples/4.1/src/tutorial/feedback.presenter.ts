import { type Locale } from 'discord.js'
import { Theme } from 'meocord/common'
import { Service } from 'meocord/decorator'
import { type PresentedError, type ResponseContext, type ResponsePresenter, type ResponseView } from 'meocord/interface'
import { t } from '@src/tutorial/i18n'

// #region presenter
// How the bot looks while it works and when something fails, in the member's language
@Service()
export class FeedbackPresenter implements ResponsePresenter {
  loading({ locale }: ResponseContext): ResponseView {
    return { text: t.locale(locale as Locale)('presenter.loading'), emoji: '⏳', color: Theme.primaryColor }
  }

  error({ locale }: ResponseContext, { message }: PresentedError): ResponseView {
    return { title: t.locale(locale as Locale)('presenter.failed'), text: message, color: Theme.errorColor }
  }
}
// #endregion presenter
