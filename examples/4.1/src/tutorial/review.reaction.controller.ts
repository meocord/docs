import { type MessageReaction, type PartialMessageReaction } from 'discord.js'
import { Controller, ReactionHandler } from 'meocord/decorator'
import { ReactionHandlerAction } from 'meocord/enum'
import { type ReactionHandlerOptions } from 'meocord/interface'
import { FeedbackService } from '@src/tutorial/feedback.service'
import { FeedbackSettings } from '@src/tutorial/feedback.settings'
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

// #region reactions
// Staff decide feedback by reacting to the bot's filing reply, which names it as #3: ✅ approves, ❌ rejects
@Controller()
export class ReviewReactionController {
  constructor(
    private readonly feedback: FeedbackService,
    private readonly settings: FeedbackSettings,
  ) {}

  @ReactionHandler('✅')
  async approve(reaction: MessageReaction | PartialMessageReaction, options: ReactionHandlerOptions) {
    await this.decide(reaction, options, 'approved')
  }

  @ReactionHandler('❌')
  async reject(reaction: MessageReaction | PartialMessageReaction, options: ReactionHandlerOptions) {
    await this.decide(reaction, options, 'rejected')
  }

  private async decide(
    reaction: MessageReaction | PartialMessageReaction,
    { user, action }: ReactionHandlerOptions,
    status: 'approved' | 'rejected',
  ) {
    // MeoCord fetched the message before this ran, so its author and text are there
    const { message } = reaction
    const { guild } = message
    // Only a reaction added to the bot's own filing reply counts, and only from the staff
    if (action !== ReactionHandlerAction.ADD || !guild || message.author?.id !== message.client.user.id) return
    const member = await guild.members.fetch(user.id)
    if (!member.roles.cache.has(this.settings.staffRoleId)) return
    const id = /#(\d+)/.exec(message.content ?? '')?.[1]
    if (!id) return
    const feedback = this.feedback.decide(id, status)
    // before:localisation await message.reply(`Feedback #${feedback.id} is ${feedback.status}.`)
    // #region step:localisation
    await message.reply(t.forGuild(guild)(`feedback.chat.status.${feedback.status}`, { id: feedback.id }))
    // #endregion step:localisation
  }
}
// #endregion reactions
