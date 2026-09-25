// #region filter
import { type ExecutionContext } from 'meocord/common'
import { Catch } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'

export class UnknownAccountError extends Error {}

@Catch(UnknownAccountError)
export class UnknownAccountFilter implements ExceptionFilter<UnknownAccountError> {
  async catch(error: UnknownAccountError, context: ExecutionContext) {
    // The params as they were when the error was thrown: here the pipe threw, so the uid is still the text
    const { uid } = context.getHandlerParams<{ uid: string }>() ?? {}
    await context.response?.error(error, { message: `There is no account ${uid}.`, visibility: 'private' })
  }
}
// #endregion filter
