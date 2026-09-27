import { type ButtonInteraction, EmbedBuilder } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Defer } from 'meocord/decorator'
// #region step:guards
import { UseGuard } from 'meocord/decorator'
// #endregion step:guards
// #region step:exception-filters
import { UseFilter } from 'meocord/decorator'
// #endregion step:exception-filters
// #region step:theming
import { useTheme } from 'meocord/common'
import { UseTheme } from 'meocord/decorator'
// #endregion step:theming
import { CommandType } from 'meocord/enum'
// #region step:exception-filters
import { FeedbackNotFoundFilter } from '@src/tutorial/feedback-not-found.filter'
// #endregion step:exception-filters
import { FeedbackService } from '@src/tutorial/feedback.service'
// #region step:guards
import { StaffGuard } from '@src/tutorial/staff.guard'
// #endregion step:guards
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

// #region controller
@Controller()
// #region step:guards
// Both buttons need the staff role
@UseGuard(StaffGuard)
// #endregion step:guards
// #region step:exception-filters
// A missing feedback is answered in the filter's words
@UseFilter(FeedbackNotFoundFilter)
// #endregion step:exception-filters
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
