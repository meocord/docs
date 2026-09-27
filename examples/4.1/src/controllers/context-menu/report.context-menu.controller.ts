// The interactions are imported as values, so the startup check can read each handler's kind
import { MessageContextMenuCommandInteraction, MessageFlags, UserContextMenuCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { BookmarkBuilder, ReportUserBuilder } from '@src/controllers/context-menu/builders/report.builder'

@Controller()
export class ReportContextMenuController {
  // #region user
  // Right-click a member, then Apps › Report user
  @Command('Report user', ReportUserBuilder)
  async report(interaction: UserContextMenuCommandInteraction) {
    await respond(interaction).send({
      content: `Thanks, ${interaction.targetUser.username} was reported to the staff.`,
      flags: MessageFlags.Ephemeral,
    })
  }
  // #endregion user

  // #region message
  // Right-click a message, then Apps › Bookmark
  @Command('Bookmark', BookmarkBuilder)
  async bookmark(interaction: MessageContextMenuCommandInteraction) {
    await interaction.user.send({ content: `Bookmarked: ${interaction.targetMessage.url}` })
    await respond(interaction).send({ content: 'Sent to your DMs.', flags: MessageFlags.Ephemeral })
  }
  // #endregion message
}
