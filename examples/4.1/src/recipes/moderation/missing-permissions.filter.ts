import { DiscordAPIError } from 'discord.js'
import { type ExecutionContext } from 'meocord/common'
import { Catch } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'

// #region filter
@Catch(DiscordAPIError)
export class MissingPermissionsFilter implements ExceptionFilter<DiscordAPIError> {
  async catch(error: DiscordAPIError, context: ExecutionContext) {
    // 50013: the bot's role lacks the permission, or sits below the member's highest role
    const message =
      error.code === 50013
        ? 'I can’t do that: my role needs the permission, and must be above the member’s highest role.'
        : undefined
    await context.response?.error(error, { message, visibility: 'private' })
  }
}
// #endregion filter
