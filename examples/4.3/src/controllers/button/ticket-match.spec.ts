import { describe, expect, it } from 'vitest'
import { ticketActions } from '@src/controllers/button/ticket-match'

describe('ticketActions', () => {
  it('reads each ticket customId back into its params, and skips the others', () => {
    expect(ticketActions(['ticket/42/close', 'poll/7', 'ticket/43/reopen', 'ticket/44/delete'])).toEqual([
      { id: '42', action: 'close' },
      { id: '43', action: 'reopen' },
    ])
  })
})
