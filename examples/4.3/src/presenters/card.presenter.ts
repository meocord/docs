// #region presenter
import { resolveColor } from 'discord.js'
import { Service } from 'meocord/decorator'
import {
  type MessageResponseContext,
  type PresentedError,
  type ResponseContext,
  type ResponsePresenter,
  type ResponseView,
} from 'meocord/interface'
import { CardRenderer } from '@src/presenters/card.renderer'

/** Draws the bot's errors as image cards, for interactions and message commands alike. */
@Service()
export class CardPresenter implements ResponsePresenter {
  constructor(private readonly cards: CardRenderer) {}

  loading({ theme }: ResponseContext) {
    return { text: 'Hang on…', emoji: theme.emojis.loading }
  }

  error(context: ResponseContext, error: PresentedError) {
    return this.card(context, error)
  }

  // A message command's usage reply, refusals and errors
  messageError(context: MessageResponseContext, error: PresentedError) {
    return this.card(context, error)
  }

  private async card({ theme }: ResponseContext | MessageResponseContext, { message, tone }: PresentedError) {
    const color = theme.colors[tone]
    const accent = `#${resolveColor(color).toString(16).padStart(6, '0')}`
    const data = await this.cards.draw(tone === 'warning' ? 'Not quite' : 'Something went wrong', message, accent)
    return { text: message, color, files: [{ name: 'error.png', data }], image: 'error.png' } satisfies ResponseView
  }
}
// #endregion presenter
