// #region filter
import { type ExecutionContext } from 'meocord/common'
import { Catch } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'

export class RateLimitedError extends Error {
  constructor(readonly retryAfter: number) {
    super(`Rate limited for ${retryAfter}s`)
  }
}

@Catch(RateLimitedError)
export class RateLimitedFilter implements ExceptionFilter<RateLimitedError> {
  async catch(error: RateLimitedError, context: ExecutionContext) {
    // The same answer the handler was building: respond() picks reply, edit or follow-up
    await context.response?.error(error, {
      message: `Slow down: try again in ${error.retryAfter}s.`,
      visibility: 'private',
    })
  }
}
// #endregion filter
