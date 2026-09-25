import { type ChatInputCommandInteraction } from 'discord.js'
import { applyDecorators, createMetadata, ExecutionContext, GuardDeniedError } from 'meocord/common'
import { Guard, UseGuard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

// #region guard
const RequiredPermission = createMetadata<bigint>('requiredPermission')

// Checks the member's permissions on every call, whatever a server has changed in its command settings
@Guard()
export class PermissionGuard implements GuardInterface {
  constructor(private readonly context: ExecutionContext) {}

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    const permission = this.context.get(RequiredPermission)
    if (permission === undefined || interaction.memberPermissions?.has(permission)) return true
    throw new GuardDeniedError('You don’t have the permission this command needs.')
  }
}

export const RequirePermission = (permission: bigint) =>
  applyDecorators(RequiredPermission(permission), UseGuard(PermissionGuard))
// #endregion guard
