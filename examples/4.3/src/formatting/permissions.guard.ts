// #region guard
import { type ChatInputCommandInteraction, type PermissionResolvable } from 'discord.js'
import { GuardDeniedError, permissionNames } from 'meocord/common'
import { Guard, UseGuard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

@Guard()
export class PermissionsGuard implements GuardInterface {
  declare readonly params?: { needs: PermissionResolvable[] }

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    const missing = interaction.memberPermissions?.missing(this.params?.needs ?? []) ?? []
    // "You need Ban Members and Manage Messages.", in the member's language
    if (missing.length > 0)
      throw new GuardDeniedError(`You need ${permissionNames(missing, interaction, { join: 'and' })}.`)
    return true
  }
}

export const NeedsPermissions = (...needs: PermissionResolvable[]) =>
  UseGuard({ provide: PermissionsGuard, params: { needs } })
// #endregion guard
