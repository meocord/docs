import { MessageFlags, type ModalSubmitInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class FeedbackModalController {
  // #region modal
  // The second argument holds the captured `ticketId` and the submitted `body` field
  @Command('feedback/{ticketId}', CommandType.MODAL_SUBMIT)
  async submit(interaction: ModalSubmitInteraction, { ticketId, body }: { ticketId: string; body: string }) {
    await respond(interaction).send({ content: `Ticket ${ticketId}: ${body}`, flags: MessageFlags.Ephemeral })
  }
  // #endregion modal
}
