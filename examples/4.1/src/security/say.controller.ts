import { type ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { RequirePermission } from '@src/security/permission.guard'
import { SayCommandBuilder } from '@src/security/say.builder'

// #region controller
@Controller()
export class SayController {
  @Command('say', SayCommandBuilder)
  @RequirePermission(PermissionFlagsBits.ManageMessages)
  async say(interaction: ChatInputCommandInteraction, { message }: { message: string }) {
    // Posts the text as written, and pings no one: not @everyone, not a role, not a member
    await respond(interaction).send({ content: message, allowedMentions: { parse: [] } })
  }
}
// #endregion controller
