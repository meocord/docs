// #region interceptor
import { type ExecutionContext, Logger } from 'meocord/common'
import { Interceptor } from 'meocord/decorator'
import { type CallHandler, type InterceptorInterface } from 'meocord/interface'

@Interceptor()
export class TimingInterceptor implements InterceptorInterface {
  private readonly logger = new Logger(TimingInterceptor.name)

  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const started = performance.now()
    try {
      return await next.handle()
    } finally {
      this.logger.log(`${context.getHandlerName()} took ${Math.round(performance.now() - started)} ms`)
    }
  }
}
// #endregion interceptor
