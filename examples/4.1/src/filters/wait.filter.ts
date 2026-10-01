// #region filter
import { time } from 'discord.js'
import { CooldownError, type ExecutionContext } from 'meocord/common'
import { Catch } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'

// The wait in the app's own words, its end as a Discord timestamp that counts down
@Catch(CooldownError)
export class WaitFilter implements ExceptionFilter<CooldownError> {
  async catch(error: CooldownError, context: ExecutionContext) {
    await context.response?.error(error, { message: `Slow down: try again ${time(error.retryAt, 'R')}.` })
  }
}
// #endregion filter
