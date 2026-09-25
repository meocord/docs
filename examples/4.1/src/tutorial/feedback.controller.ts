import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  type ModalActionRowComponentBuilder,
  ModalBuilder,
  type ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js'
import { respond, Theme } from 'meocord/common'
import { Command, Controller, Cooldown } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { FeedbackCommandBuilder } from '@src/tutorial/feedback.builder'
import { FeedbackService } from '@src/tutorial/feedback.service'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'
import { t } from '@src/tutorial/i18n'

@Controller()
export class FeedbackController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly settings: FeedbackSettings,
  ) {}

  // #region open
  // `/feedback` opens a form; the form's custom ID routes its submission below
  @Command('feedback', FeedbackCommandBuilder)
  @Cooldown({ uses: 1, seconds: 300 })
  async open(interaction: ChatInputCommandInteraction) {
    const text = t.for(interaction)
    const input = (id: string, label: string, style: TextInputStyle, maxLength: number) =>
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setMaxLength(maxLength),
      )
    await respond(interaction).modal(
      new ModalBuilder()
        .setCustomId('feedback/submit')
        .setTitle(text('feedback.modal.title'))
        .addComponents(
          input('about', text('feedback.modal.about'), TextInputStyle.Short, 80),
          input('details', text('feedback.modal.details'), TextInputStyle.Paragraph, 1000),
        ),
    )
  }
  // #endregion open

  // #region submit
  // The form's fields arrive as the second argument, named by their custom IDs
  @Command('feedback/submit', CommandType.MODAL_SUBMIT)
  async submit(interaction: ModalSubmitInteraction, { about, details }: { about: string; details: string }) {
    const feedback = this.feedback.add({ authorId: interaction.user.id, locale: interaction.locale, about, details })

    // The review post is in the server's language, since the whole staff reads it
    const staff = t.for(interaction, { public: true })
    const button = (verdict: 'approve' | 'reject', style: ButtonStyle) =>
      new ButtonBuilder()
        .setCustomId(`feedback/${feedback.id}/${verdict}`)
        .setLabel(staff(`feedback.review.${verdict}`))
        .setStyle(style)
    const channel = await interaction.client.channels.fetch(this.settings.reviewChannelId)
    if (!channel?.isSendable()) throw new Error('FEEDBACK_CHANNEL_ID is not a channel the bot can post in.')
    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(staff('feedback.review.heading', { id: feedback.id, user: interaction.user.username }))
          .setDescription(`**${about}**\n${details}`)
          .setColor(Theme.primaryColor),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          button('approve', ButtonStyle.Success),
          button('reject', ButtonStyle.Danger),
        ),
      ],
    })

    await respond(interaction).send({ content: t.for(interaction)('feedback.thanks'), flags: MessageFlags.Ephemeral })
  }
  // #endregion submit
}
