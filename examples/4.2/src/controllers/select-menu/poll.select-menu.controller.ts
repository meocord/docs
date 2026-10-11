import { MessageFlags, type StringSelectMenuInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region values
@Controller()
export class PollSelectMenuController {
  // poll/{pollId} captures the poll; values holds the options the member chose
  @Command('poll/{pollId}', CommandType.SELECT_MENU)
  async vote(interaction: StringSelectMenuInteraction, { pollId, values }: { pollId: string; values: string[] }) {
    // A follow-up, so only the voter sees it: send() would update the poll message, for everyone
    await respond(interaction).followUp({
      content: `Poll ${pollId}: you picked ${values.join(', ')}.`,
      flags: MessageFlags.Ephemeral,
    })
  }
}
// #endregion values
