// #region observer
import { type Span, SpanStatusCode, trace } from '@opentelemetry/api'
import { type ExecutionContext } from 'meocord/common'
import { Observer } from 'meocord/decorator'
import { type DispatchObserver, type DispatchResult } from 'meocord/interface'

const tracer = trace.getTracer('bot')

// The call's own span, from the moment it arrives, whatever the outcome
@Observer()
export class CallSpanObserver implements DispatchObserver {
  // onStart and onSettled for one call receive the same context object
  private readonly spans = new WeakMap<ExecutionContext, Span>()

  onStart(context: ExecutionContext) {
    this.spans.set(context, tracer.startSpan(`${context.getType()} ${context.getHandlerName() ?? 'unrouted'}`))
  }

  onSettled(context: ExecutionContext, { outcome, deniedBy, error }: DispatchResult) {
    const span = this.spans.get(context)
    if (!span) return
    span.setAttribute('meocord.outcome', outcome)
    if (deniedBy) span.setAttribute('meocord.denied_by', deniedBy.name)
    if (outcome === 'error') span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
    span.end()
  }
}
// #endregion observer
