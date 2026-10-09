// #region observer
import { type ExecutionContext } from 'meocord/common'
import { Observer } from 'meocord/decorator'
import { type DispatchObserver, type DispatchResult } from 'meocord/interface'
import { MetricsService } from '@src/services/metrics.service'

// One instance, resolved from the container, is told about every call once it has settled
@Observer()
export class MetricsObserver implements DispatchObserver {
  constructor(private readonly metrics: MetricsService) {}

  onSettled(context: ExecutionContext, { outcome, durationMs }: DispatchResult) {
    // An interaction no handler matched has no handler name
    this.metrics.record(context.getType(), context.getHandlerName() ?? 'unrouted', outcome, durationMs)
  }
}
// #endregion observer
