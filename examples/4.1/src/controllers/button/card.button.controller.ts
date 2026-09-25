import { type ButtonInteraction, EmbedBuilder, MessageFlags } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Defer, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { OwnerGuard } from '@src/guards/owner.guard'

@Controller()
export class CardButtonController {
  // #region defer
  @Command('card/{ownerId}/refresh', CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  @Defer()
  async refresh(interaction: ButtonInteraction) {
    const card = new EmbedBuilder().setTitle('Refreshed').setTimestamp()
    // Without `components`, the buttons come back as they were before the lock
    await respond(interaction).send({ embeds: [card] })
  }
  // #endregion defer

  // #region auto
  // Answers at once, so it replies with one update and nothing is ever locked
  @Command('card/{ownerId}/like', CommandType.BUTTON)
  @Defer({ mode: 'auto' })
  async like(interaction: ButtonInteraction) {
    await respond(interaction).send({ content: 'Liked.' })
  }
  // #endregion auto

  // #region clicked
  // Disables only the clicked button, so the others stay usable while it runs
  @Command('card/{ownerId}/export', CommandType.BUTTON)
  @Defer({ disable: 'clicked' })
  async export(interaction: ButtonInteraction) {
    await respond(interaction).followUp({ content: 'Your export is ready.', flags: MessageFlags.Ephemeral })
  }
  // #endregion clicked
}
