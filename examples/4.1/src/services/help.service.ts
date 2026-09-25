// #region service
import { HandlerRegistry } from 'meocord/core'
import { Service } from 'meocord/decorator'

@Service()
export class HelpService {
  constructor(private readonly handlers: HandlerRegistry) {}

  // One line per slash command and subcommand, for a /help reply
  lines(): string[] {
    return this.handlers
      .list({ kind: 'command' })
      .map(handler => `/${handler.name}: ${handler.description ?? 'No description'}`)
  }
}
// #endregion service
