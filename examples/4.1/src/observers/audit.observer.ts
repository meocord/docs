// #region observer
import { type BaseInteraction } from 'discord.js'
import { type ExecutionContext, Logger } from 'meocord/common'
import { Observer } from 'meocord/decorator'
import { type DispatchObserver, type DispatchResult } from 'meocord/interface'
import { RefusalLog } from '@src/services/refusal-log.service'

// Told only about interactions: commands, components, modals and autocomplete
@Observer({ types: ['interaction'] })
export class AuditObserver implements DispatchObserver {
  private readonly logger = new Logger(AuditObserver.name)

  constructor(private readonly refusals: RefusalLog) {}

  async onSettled(context: ExecutionContext, { outcome, deniedBy, response, startedAt }: DispatchResult) {
    const interaction = context.getArgs()[0] as BaseInteraction
    const handler = context.getHandlerName() ?? 'unrouted'

    // A handler that deferred and never followed up leaves the user on "thinking…"
    if (response === 'deferred') this.logger.warn(`${handler} deferred and never answered`)

    // Only what was refused: a denied, rate-limited or invalid call, or one no handler matched
    if (outcome === 'ran' || outcome === 'error') return
    this.refusals.write({
      user: interaction.user.id,
      handler,
      outcome,
      deniedBy: deniedBy?.name,
      at: new Date(startedAt),
    })
  }
}
// #endregion observer
