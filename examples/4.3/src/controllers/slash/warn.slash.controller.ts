import { type ChatInputCommandInteraction, type User } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { WarnCommandBuilder } from '@src/controllers/slash/builders/warn.builder'
import { t } from '@src/i18n'

@Controller()
export class WarnSlashController {
  // #region reply
  // Interactions report the default name, so the route is `warn` in every language
  @Command('warn', WarnCommandBuilder)
  async warn(interaction: ChatInputCommandInteraction, { member }: { member: User }) {
    // In the language of the user who ran the command
    await respond(interaction).send({ content: t.for(interaction)('warn.done', { user: member.username }) })
  }
  // #endregion reply
}
