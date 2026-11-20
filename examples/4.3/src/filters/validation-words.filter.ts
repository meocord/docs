// #region filter
import { type ExecutionContext, ValidationError, type ValidationIssue } from 'meocord/common'
import { Catch } from 'meocord/decorator'
import { type ExceptionFilter } from 'meocord/interface'
import { type z } from 'zod'

/** One issue in the bot's own words, from the fields zod reported; others keep the library's message. */
export function wordIssue(issue: ValidationIssue): string {
  const raw = issue.raw as z.core.$ZodIssue | undefined
  const field = issue.path.join('.') || 'the input'
  switch (raw?.code) {
    case 'too_small':
      return `${field} must be at least ${raw.minimum}.`
    case 'too_big':
      return `${field} must be at most ${raw.maximum}.`
    default:
      return issue.message
  }
}

@Catch(ValidationError)
export class ValidationWordsFilter implements ExceptionFilter<ValidationError> {
  async catch(error: ValidationError, context: ExecutionContext) {
    await context.response?.error(error, { message: error.issues.map(wordIssue).join('\n'), visibility: 'private' })
  }
}
// #endregion filter
