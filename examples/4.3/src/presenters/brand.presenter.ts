// #region presenter
import { Service } from 'meocord/decorator'
import { type PresentedError, type ResponseContext, type ResponsePresenter } from 'meocord/interface'

@Service()
export class BrandPresenter implements ResponsePresenter {
  loading({ theme }: ResponseContext) {
    return { text: 'Hang on…', emoji: theme.emojis.loading, color: theme.colors.primary }
  }

  // `tone` is 'warning' when the user can fix it, such as a refused or invalid call, and 'danger' for a fault
  error({ theme }: ResponseContext, { message, tone }: PresentedError) {
    return {
      title: tone === 'warning' ? 'Not quite' : 'Something went wrong',
      text: message,
      color: theme.colors[tone],
    }
  }
}
// #endregion presenter
