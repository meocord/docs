// #region guard
import { type ChatInputCommandInteraction } from 'discord.js'
import { applyDecorators, createMetadata, ExecutionContext } from 'meocord/common'
import { Guard, UseGuard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

// A typed decorator that stores a value on a handler, or on a whole controller: here, the IDs of the roles it requires
export const Roles = createMetadata<string[]>('roles')

@Guard()
export class RolesGuard implements GuardInterface {
  // Each call gets its own context, describing the handler being guarded
  constructor(private readonly context: ExecutionContext) {}

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    const required = this.context.get(Roles) ?? []
    if (required.length === 0) return true
    // A member's roles are keyed by ID, which is what Roles holds
    return interaction.inCachedGuild() && required.some(roleId => interaction.member.roles.cache.has(roleId))
  }
}

export const RequireRoles = (...roleIds: string[]) => applyDecorators(Roles(roleIds), UseGuard(RolesGuard))
// #endregion guard
