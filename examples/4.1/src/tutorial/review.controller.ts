import { type ButtonInteraction, EmbedBuilder } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Defer, UseFilter, UseGuard } from 'meocord/decorator'
// #region step:theming
import { useTheme } from 'meocord/common'
import { UseTheme } from 'meocord/decorator'
// #endregion step:theming
import { CommandType } from 'meocord/enum'
import { FeedbackNotFoundFilter } from '@src/tutorial/feedback-not-found.filter'
import { FeedbackService } from '@src/tutorial/feedback.service'
import { StaffGuard } from '@src/tutorial/staff.guard'
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

// #region controller
// Both buttons need the staff role, and answer a missing feedback with the filter's words
@Controller()
@UseGuard(StaffGuard)
@UseFilter(FeedbackNotFoundFilter)
// #region step:theming
@UseTheme({ emojis: { loading: '📝' } })
// #endregion step:theming
export class ReviewController {
  constructor(private readonly feedback: FeedbackService) {}

  @Command('feedback/{id}/approve', CommandType.BUTTON)
  @Defer()
  async approve(interaction: ButtonInteraction, { id }: { id: string }) {
    await this.decide(interaction, id, 'approved')
  }

  @Command('feedback/{id}/reject', CommandType.BUTTON)
  @Defer()
  async reject(interaction: ButtonInteraction, { id }: { id: string }) {
    await this.decide(interaction, id, 'rejected')
  }

  private async decide(interaction: ButtonInteraction, id: string, status: 'approved' | 'rejected') {
    const feedback = this.feedback.decide(id, status)

    // The review post keeps its text, gains the verdict, and loses its buttons
    // #region step:localisation
    const staff = t.for(interaction, { public: true })
    // #endregion step:localisation
    const [post] = interaction.message.embeds
    // before:localisation const verdict = (post ? EmbedBuilder.from(post) : new EmbedBuilder()).setFooter({ text: `${status === 'approved' ? 'Approved' : 'Rejected'} by ${interaction.user.username}.` })
    // #region step:localisation
    const verdict = (post ? EmbedBuilder.from(post) : new EmbedBuilder()).setFooter({
      text: staff(`feedback.review.${status}`, { user: interaction.user.username }),
    })
    // #endregion step:localisation
    // #region step:theming
    verdict.setColor(useTheme().colors[status === 'approved' ? 'success' : 'danger'])
    // #endregion step:theming
    await respond(interaction).send({ embeds: [verdict], components: [] })

    // The author hears back in their own language; closed DMs are not the reviewer's problem
    // before:localisation const text = status === 'approved' ? `Your feedback “${feedback.about}” was approved. Thank you!` : `Your feedback “${feedback.about}” was not taken up this time.`
    // #region step:localisation
    const text = t.locale(feedback.locale)(`feedback.verdict.${status}`, { about: feedback.about })
    // #endregion step:localisation
    await interaction.client.users.send(feedback.authorId, { content: text }).catch(() => undefined)
  }
}
// #endregion controller
