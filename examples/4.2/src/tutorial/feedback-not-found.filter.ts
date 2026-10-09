import { type ExecutionContext } from 'meocord/common'
import { Catch } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'
import { FeedbackNotFoundError } from '@src/tutorial/feedback.errors'
import { t } from '@src/tutorial/i18n'

// #region filter
// A review button whose feedback is gone, such as one posted before a restart
@Catch(FeedbackNotFoundError)
export class FeedbackNotFoundFilter implements ExceptionFilter<FeedbackNotFoundError> {
  async catch(error: FeedbackNotFoundError, context: ExecutionContext) {
    const interaction = context.getInteraction()
    const message = interaction ? t.for(interaction)('feedback.notFound') : undefined
    await context.response?.error(error, { message, visibility: 'private' })
  }
}
// #endregion filter
