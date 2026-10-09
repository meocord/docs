// #region guard
import { type ButtonInteraction } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

/** Lets only the user whose id the button carries use it: `card/{ownerId}/…` */
@Guard()
export class OwnerGuard implements GuardInterface {
  canActivate(interaction: ButtonInteraction, { ownerId }: { ownerId: string }): boolean {
    // Thrown, it is answered privately; returning false would deny silently
    if (interaction.user.id !== ownerId) throw new GuardDeniedError('Only the user who opened this can use it.')
    return true
  }
}
// #endregion guard
