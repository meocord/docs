// #region presenter
import { Theme } from 'meocord/common'
import { Service } from 'meocord/decorator'
import { type PresentedError, type ResponseContext, type ResponsePresenter } from 'meocord/interface'

@Service()
export class BrandPresenter implements ResponsePresenter {
  loading(_context: ResponseContext) {
    return { text: 'Hang on…', emoji: '⏳', color: Theme.primaryColor }
  }

  error(_context: ResponseContext, { message }: PresentedError) {
    return { title: 'Something went wrong', text: message, color: Theme.errorColor }
  }
}
// #endregion presenter
