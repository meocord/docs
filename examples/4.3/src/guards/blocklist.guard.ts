import { type Interaction } from 'discord.js'
import { Guard } from 'meocord/decorator'
import { type GuardInterface } from 'meocord/interface'

const BLOCKED = new Set(['666666666666666666'])

// Global, and written for interactions only
@Guard({ types: ['interaction'] })
export class BlocklistGuard implements GuardInterface {
  canActivate(interaction: Interaction): boolean {
    return !BLOCKED.has(interaction.user.id)
  }
}
