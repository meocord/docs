import { type Message } from 'discord.js'
import { UserError } from 'meocord/common'
import { Controller, MeoCord, On } from 'meocord/decorator'
import { createMockMessage, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

@Controller()
class LinkFilterController {
  @On('messageCreate')
  async check(message: Message) {
    if (/https?:\/\//.test(message.content)) throw new UserError('Links go in #links.')
  }
}

@MeoCord({ controllers: [LinkFilterController], clientOptions: { intents: [] } })
class LinkApp {}

describe('emit', () => {
  // #region fallback
  it('answers a UserError as the bot does with eventFallback', async () => {
    const module = MeoCordTestingModule.fromApp(LinkApp, { eventFallback: true }).compile()
    const message = createMockMessage({ content: 'see https://example.com' })

    // The bot's fallback replies to the message, and emit resolves
    await expect(module.emit('messageCreate', message)).resolves.toEqual({ ran: 1 })
    expect(message.reply).toHaveBeenCalledOnce()
  })
  // #endregion fallback
})
