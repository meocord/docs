import { type Message } from 'discord.js'
import { Controller, MessageHandler } from 'meocord/decorator'
import { FeedbackNotFoundError } from '@src/tutorial/feedback.errors'
import { FeedbackService } from '@src/tutorial/feedback.service'
// #region step:localisation
import { t } from '@src/tutorial/i18n'
// #endregion step:localisation

@Controller()
export class FeedbackMessageController {
  constructor(private readonly feedback: FeedbackService) {}

  // #region message-commands
  // @Feedback feedback idea Add a dark mode
  @MessageHandler('feedback {about:bug|idea|praise} {details...}', {
    description: 'Files feedback from chat.',
    scope: 'guild',
  })
  async file(message: Message<true>, { about, details }: { about: 'bug' | 'idea' | 'praise'; details: string }) {
    const locale = message.guild.preferredLocale
    const feedback = this.feedback.add({ authorId: message.author.id, locale, about, details })
    // before:localisation await message.reply(`Filed as feedback #${feedback.id}. Thank you!`)
    // #region step:localisation
    // In the server's language, as the whole channel reads it
    await message.reply(t.forGuild(message.guild)('feedback.chat.filed', { id: feedback.id }))
    // #endregion step:localisation
  }
  // #endregion message-commands

  // #region message-params
  // @Feedback status 3    @Feedback status 3 --details
  @MessageHandler('status {id:int} {--details}', {
    description: 'Says where a piece of feedback stands.',
    scope: 'guild',
  })
  async status(message: Message<true>, { id, details }: { id: number; details: boolean }) {
    try {
      const feedback = this.feedback.get(String(id))
      // before:localisation const said = `Feedback #${feedback.id} is ${feedback.status}.`
      // #region step:localisation
      const said = t.forGuild(message.guild)(`feedback.chat.status.${feedback.status}`, { id: feedback.id })
      // #endregion step:localisation
      await message.reply(details ? `${said}\n> ${feedback.details}` : said)
    } catch (error) {
      if (!(error instanceof FeedbackNotFoundError)) throw error
      // before:localisation await message.reply(`There is no feedback #${id}.`)
      // #region step:localisation
      await message.reply(t.forGuild(message.guild)('feedback.chat.unknown', { id }))
      // #endregion step:localisation
    }
  }
  // #endregion message-params
}
