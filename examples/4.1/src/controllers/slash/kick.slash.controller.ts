import { type ChatInputCommandInteraction, type User } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { KickCommandBuilder } from '@src/controllers/slash/builders/kick.builder'

@Controller()
export class KickSlashController {
  // #region options
  @Command('kick', KickCommandBuilder)
  async kick(interaction: ChatInputCommandInteraction, { target, reason }: { target: User; reason?: string }) {
    // target arrives resolved, a User rather than its id
    await respond(interaction).send({ content: `Kicked ${target.username}: ${reason ?? 'no reason given'}` })
  }
  // #endregion options
}
