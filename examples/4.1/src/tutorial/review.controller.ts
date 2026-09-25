import { type ButtonInteraction, EmbedBuilder } from 'discord.js'
import { respond, Theme } from 'meocord/common'
import { Command, Controller, Defer, UseFilter, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { FeedbackNotFoundFilter } from '@src/tutorial/feedback-not-found.filter'
import { FeedbackService } from '@src/tutorial/feedback.service'
import { StaffGuard } from '@src/tutorial/staff.guard'
import { t } from '@src/tutorial/i18n'

// #region controller
// Both buttons need the staff role, and answer a missing feedback with the filter's words
@Controller()
@UseGuard(StaffGuard)
@UseFilter(FeedbackNotFoundFilter)
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
    const staff = t.for(interaction, { public: true })
    const [post] = interaction.message.embeds
    const verdict = (post ? EmbedBuilder.from(post) : new EmbedBuilder())
      .setFooter({ text: staff(`feedback.review.${status}`, { user: interaction.user.username }) })
      .setColor(status === 'approved' ? Theme.successColor : Theme.errorColor)
    await respond(interaction).send({ embeds: [verdict], components: [] })

    // The author hears back in their own language; closed DMs are not the reviewer's problem
    const text = t.locale(feedback.locale)(`feedback.verdict.${status}`, { about: feedback.about })
    await interaction.client.users.send(feedback.authorId, { content: text }).catch(() => undefined)
  }
}
// #endregion controller
