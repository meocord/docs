import { type ButtonInteraction, PermissionFlagsBits } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

// #region guard
// The member who opened the ticket, or staff who can manage threads, may close it
@Guard()
export class TicketCloserGuard implements GuardInterface {
  canActivate(interaction: ButtonInteraction, { ownerId }: { ownerId: string }): boolean {
    if (interaction.user.id === ownerId) return true
    if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads)) return true
    throw new GuardDeniedError('Only the member who opened this ticket, or the staff, can close it.')
  }
}
// #endregion guard
