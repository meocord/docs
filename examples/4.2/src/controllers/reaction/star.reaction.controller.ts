// #region controller
import { type MessageReaction, type PartialMessageReaction } from 'discord.js'
import { Controller, ReactionHandler } from 'meocord/decorator'
import { ReactionHandlerAction } from 'meocord/enum'
import { type ReactionEvent } from 'meocord/interface'

@Controller()
export class StarReactionController {
  @ReactionHandler('⭐')
  async star(reaction: MessageReaction | PartialMessageReaction, { user, action }: ReactionEvent) {
    if (action !== ReactionHandlerAction.ADD || user.bot) return
    await reaction.message.reply(`${user.username} starred this.`)
  }
}
// #endregion controller
