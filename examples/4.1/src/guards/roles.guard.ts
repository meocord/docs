// #region guard
import { type ChatInputCommandInteraction } from 'discord.js'
import { applyDecorators, createMetadata, ExecutionContext } from 'meocord/common'
import { Guard, UseGuard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

// A typed decorator that stores a value on a handler, or on a whole controller
export const Roles = createMetadata<string[]>('roles')

@Guard()
export class RolesGuard implements GuardInterface {
  // Each call gets its own context, describing the handler being guarded
  constructor(private readonly context: ExecutionContext) {}

  canActivate(interaction: ChatInputCommandInteraction): boolean {
    const required = this.context.get(Roles) ?? []
    if (required.length === 0) return true
    return interaction.inCachedGuild() && required.some(role => interaction.member.roles.cache.has(role))
  }
}

export const RequireRoles = (...roles: string[]) => applyDecorators(Roles(roles), UseGuard(RolesGuard))
// #endregion guard
