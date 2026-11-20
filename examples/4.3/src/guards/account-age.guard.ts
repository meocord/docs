// #region guard
import { type ChatInputCommandInteraction } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

/** How old an account must be to use a guarded command: a week, which keeps out accounts made for a raid. */
export const MIN_ACCOUNT_AGE = 7 * 24 * 60 * 60 * 1000

@Guard()
export class AccountAgeGuard implements GuardInterface {
  canActivate(interaction: ChatInputCommandInteraction): boolean {
    // Thrown, it is answered privately; returning false would deny without a word
    if (Date.now() - interaction.user.createdTimestamp < MIN_ACCOUNT_AGE) {
      throw new GuardDeniedError('Your account must be at least a week old to use this.')
    }
    return true
  }
}
// #endregion guard
