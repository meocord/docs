import { type ChatInputCommandInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class ProfileSlashController {
  // #region respond
  @Command('profile', CommandType.SLASH)
  async profile(interaction: ChatInputCommandInteraction) {
    // "thinking…" while the profile loads
    await respond(interaction).acknowledge()
    const card = new EmbedBuilder().setTitle(interaction.user.username)
    // Deferred, so this edits the reply
    await respond(interaction).send({ embeds: [card] })
    // Private, and only this message: flags never carry over to the next call
    await respond(interaction).followUp({ content: 'Tip: /profile works in DMs too.', flags: MessageFlags.Ephemeral })
  }
  // #endregion respond
}
