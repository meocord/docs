// #region interceptor
import { type ExecutionContext } from 'meocord/common'
import { Interceptor } from 'meocord/decorator'
import { type CallHandler, type InterceptorInterface } from 'meocord/interface'
import { ErrorReporter } from '@src/services/error-reporter.service'

// One instance serves every call, so it can inject services; per-call state stays in locals
@Interceptor({ types: ['interaction'] })
export class ReportingInterceptor implements InterceptorInterface {
  constructor(private readonly reporter: ErrorReporter) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    try {
      return await next.handle()
    } catch (error) {
      this.reporter.report(error, `${context.getController()?.name}.${context.getHandlerName()}`)
      // Thrown on, so the filters and the fallback still answer the user
      throw error
    }
  }
}
// #endregion interceptor
