import { type RouteMatch } from 'meocord/common'
import { ticketAction } from '@src/controllers/button/ticket.button.controller'

// #region match
// What the ticket route gives its handler: { id: string; action: 'close' | 'reopen' }
export type TicketAction = RouteMatch<typeof ticketAction.pattern>

/** The ticket actions among customIds the bot keeps, such as a message's other buttons; other ids are skipped. */
export function ticketActions(customIds: readonly string[]): TicketAction[] {
  return customIds.flatMap(customId => ticketAction.match(customId) ?? [])
}
// #endregion match
