import { ButtonInteraction } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { ticketAction, TicketButtonController } from '@src/controllers/button/ticket.button.controller'

describe('TicketButtonController', () => {
  it('routes the customId the route built back to its handler', async () => {
    const module = MeoCordTestingModule.create({ controllers: [TicketButtonController] }).compile()
    const click = createMockInteraction(ButtonInteraction, {
      customId: ticketAction.build({ id: 42, action: 'close' }),
    })

    const { handlers } = await module.dispatch(click)

    expect(handlers.map(({ method }) => method)).toEqual(['act'])
    expect(getResponse(click).calls[0].payload).toMatchObject({ content: 'Ticket #42: closed.' })
  })

  it('encodes a slash inside a value, so it stays in its segment', () => {
    expect(ticketAction.build({ id: 'a/b', action: 'close' })).toBe('ticket/a%2Fb/close')
  })
})
