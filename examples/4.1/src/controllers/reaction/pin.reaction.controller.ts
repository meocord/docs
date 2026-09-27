import { type MessageReaction, type PartialMessageReaction } from 'discord.js'
import { Controller, ReactionHandler } from 'meocord/decorator'
import { ReactionHandlerAction } from 'meocord/enum'
import { type ReactionHandlerOptions } from 'meocord/interface'

@Controller()
export class PinReactionController {
  readonly log: string[] = []

  // #region bots
  // A 📌 pins the message, whoever adds it: a bot's reaction counts too
  @ReactionHandler('📌', { bots: true })
  async pin(reaction: MessageReaction | PartialMessageReaction, { action }: ReactionHandlerOptions) {
    if (action === ReactionHandlerAction.ADD) await reaction.message.pin()
  }

  // Every reaction, from users and bots alike, for an audit log
  @ReactionHandler({ bots: true })
  audit(reaction: MessageReaction | PartialMessageReaction, { user, action }: ReactionHandlerOptions) {
    this.log.push(`${user.username} ${action} ${reaction.emoji.name}`)
  }
  // #endregion bots
}
