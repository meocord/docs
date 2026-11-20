import { type ButtonInteraction } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'
import { t } from '@src/tutorial/i18n'

// #region guard
// Lets members with the staff role through; anyone else is told why, privately
@Guard()
export class StaffGuard implements GuardInterface {
  constructor(private readonly settings: FeedbackSettings) {}

  canActivate(interaction: ButtonInteraction): boolean {
    if (interaction.inCachedGuild() && interaction.member.roles.cache.has(this.settings.staffRoleId)) return true
    throw new GuardDeniedError(t.for(interaction)('feedback.staffOnly'))
  }
}
// #endregion guard
