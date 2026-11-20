import { ButtonInteraction, resolveColor } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, MeoCord } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

// What a collector's collect callback does once the handler has returned
let onCollect: ((click: ButtonInteraction) => Promise<unknown>) | undefined

@Controller()
class PollController {
  @Command('poll/open', CommandType.BUTTON)
  async open(interaction: ButtonInteraction) {
    onCollect = click => respond(click).send({ embeds: [{ description: 'Vote counted' }] })
    await respond(interaction).send({ content: 'Poll open.' })
  }
}

@MeoCord({ controllers: [PollController], clientOptions: { intents: [] }, theme: { colors: { primary: '#5865F2' } } })
class PollApp {}

describe('a collector’s answer', () => {
  // #region collector
  it('takes the module’s theme when the click comes from the client the call came to', async () => {
    const module = MeoCordTestingModule.create({ app: PollApp, controllers: [PollController] }).compile()
    const open = createMockInteraction(ButtonInteraction, { customId: 'poll/open' })
    await module.dispatch(open)

    // The gateway gives a collector's click the bot's client
    const vote = createMockInteraction(ButtonInteraction, { customId: 'poll-vote', client: open.client })
    await onCollect!(vote)

    const { embeds } = getResponse(vote).calls[0].payload as { embeds: { color?: number }[] }
    expect(embeds[0].color).toBe(resolveColor('#5865F2'))
  })
  // #endregion collector
})
