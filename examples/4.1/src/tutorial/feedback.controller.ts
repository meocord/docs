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
import { respond } from 'meocord/common'
// #region step:theming
import { useTheme } from 'meocord/common'
// #endregion step:theming
import { Command, Controller } from 'meocord/decorator'
// #region step:cooldowns
import { Cooldown } from 'meocord/decorator'
// #endregion step:cooldowns
import { CommandType } from 'meocord/enum'
import { FeedbackCommandBuilder } from '@src/tutorial/feedback.builder'
import { FeedbackService } from '@src/tutorial/feedback.service'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

@Controller()
export class FeedbackController {
  // #region constructor
  constructor(
    private readonly feedback: FeedbackService,
    private readonly settings: FeedbackSettings,
  ) {}
  // #endregion constructor

  // #region open
  // `/feedback` opens a form; the form's custom ID routes its submission below
  @Command('feedback', FeedbackCommandBuilder)
  // #region step:cooldowns
  @Cooldown({ uses: 1, seconds: 300 })
  // #endregion step:cooldowns
  async open(interaction: ChatInputCommandInteraction) {
    // #region step:localisation
    const text = t.for(interaction)
    // #endregion step:localisation
    const input = (id: string, label: string, style: TextInputStyle, maxLength: number) =>
      new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
        new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setMaxLength(maxLength),
      )
    await respond(interaction).modal(
      new ModalBuilder()
        .setCustomId('feedback/submit')
        // before:localisation .setTitle('Send feedback')
        // #region step:localisation
        .setTitle(text('feedback.modal.title'))
        // #endregion step:localisation
        .addComponents(
          // before:localisation input('about', 'What is it about?', TextInputStyle.Short, 80),
          // before:localisation input('details', 'Tell us more', TextInputStyle.Paragraph, 1000),
          // #region step:localisation
          input('about', text('feedback.modal.about'), TextInputStyle.Short, 80),
          input('details', text('feedback.modal.details'), TextInputStyle.Paragraph, 1000),
          // #endregion step:localisation
        ),
    )
  }
  // #endregion open

  // #region submit
  // The form's fields arrive as the second argument, named by their custom IDs
  @Command('feedback/submit', CommandType.MODAL_SUBMIT)
  async submit(interaction: ModalSubmitInteraction, { about, details }: { about: string; details: string }) {
    const feedback = this.feedback.add({ authorId: interaction.user.id, locale: interaction.locale, about, details })

    // #region step:localisation
    // The review post is in the server's language, since the whole staff reads it
    const staff = t.for(interaction, { public: true })
    // #endregion step:localisation
    const button = (verdict: 'approve' | 'reject', style: ButtonStyle) =>
      new ButtonBuilder()
        .setCustomId(`feedback/${feedback.id}/${verdict}`)
        // before:localisation .setLabel(verdict === 'approve' ? 'Approve' : 'Reject')
        // #region step:localisation
        .setLabel(staff(`feedback.review.${verdict}`))
        // #endregion step:localisation
        .setStyle(style)
    const channel = await interaction.client.channels.fetch(this.settings.reviewChannelId)
    if (!channel?.isSendable()) throw new Error('FEEDBACK_CHANNEL_ID is not a channel the bot can post in.')
    await channel.send({
      embeds: [
        new EmbedBuilder()
          // before:localisation .setTitle(`Feedback #${feedback.id} from ${interaction.user.username}`)
          // #region step:localisation
          .setTitle(staff('feedback.review.heading', { id: feedback.id, user: interaction.user.username }))
          // #endregion step:localisation
          // #region step:theming
          .setColor(useTheme().colors.primary)
          // #endregion step:theming
          .setDescription(`**${about}**\n${details}`),
      ],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          button('approve', ButtonStyle.Success),
          button('reject', ButtonStyle.Danger),
        ),
      ],
    })

    // before:localisation await respond(interaction).send({ content: 'Thanks! The staff will read it soon.', flags: MessageFlags.Ephemeral })
    // #region step:localisation
    await respond(interaction).send({ content: t.for(interaction)('feedback.thanks'), flags: MessageFlags.Ephemeral })
    // #endregion step:localisation
  }
  // #endregion submit
}
