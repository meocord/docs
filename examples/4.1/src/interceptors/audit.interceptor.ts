// #region interceptor
import { type ExecutionContext } from 'meocord/common'
import { Interceptor } from 'meocord/decorator'
import { type CallHandler, type InterceptorInterface } from 'meocord/interface'
import { AuditLog } from '@src/services/audit-log.service'

// Records what a call asked for and what its handler ran with
@Interceptor()
export class AuditInterceptor implements InterceptorInterface {
  constructor(private readonly audit: AuditLog) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    // Before next.handle(), the params as the call sent them
    const received = context.getHandlerParams()
    const result = await next.handle()
    // After it, validated and piped, as the handler received them; getArgs()[1] is the same value
    this.audit.record({ handler: context.getHandlerName(), received, ran: context.getHandlerParams() })
    return result
  }
}
// #endregion interceptor
