// #region interceptor
import { trace } from '@opentelemetry/api'
import { type ExecutionContext } from 'meocord/common'
import { Interceptor } from 'meocord/decorator'
import { type CallHandler, type InterceptorInterface } from 'meocord/interface'

const tracer = trace.getTracer('bot')

// The handler's span, active while it runs, so the spans it starts, a database query say, nest under it
@Interceptor()
export class HandlerSpanInterceptor implements InterceptorInterface {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    return tracer.startActiveSpan(`handler ${context.getHandlerName()}`, async span => {
      try {
        return await next.handle()
      } finally {
        span.end()
      }
    })
  }
}
// #endregion interceptor
