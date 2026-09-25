---
id: interceptors
title: 'Interceptors'
order: 14
source: readme@4.1.0-beta.0
---

Interceptors run around a handler once its guards allow the call: timing, logging, caching, mapping errors. An interceptor receives the call's `ExecutionContext` and continues with `next.handle()`, which resolves to what the handler returns. It can act before and after the handler, skip it by returning without calling `next.handle()`, or catch the error the handler throws and throw another. Call `next.handle()` at most once: each call runs the handler again.

```typescript
import { Controller, Interceptor, UseInterceptor } from 'meocord/decorator'
import { type CallHandler, type InterceptorInterface } from 'meocord/interface'
import { type ExecutionContext, Logger } from 'meocord/common'

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

@Controller()
@UseInterceptor(TimingInterceptor) // every handler in the controller; or on one method
export class ProfileController { ... }
```

Apply them like guards: on a method, on a controller, or to every handler with `@MeoCord({ interceptors })`. Global interceptors are outermost, then the controller's, then the method's; within one decorator, the first listed is outermost. A class-level `@UseInterceptor` also covers the handlers a controller inherits.

One instance of an interceptor serves every call, so it can hold a cache or counters; keep per-call state in local variables. For per-use options, pass `{ provide, params }` and read them with `context.getParams()` — they are never assigned onto the shared instance. For the same reason an interceptor cannot inject `ExecutionContext`; the bot refuses to start if one does.

Interceptors run when a handler is dispatched, or run with [`invoke`](/docs/4.1/testing#running-a-handler-with-invoke) in a test. A controller method called directly runs its guards but no interceptors. Autocomplete handlers run none.

Global interceptors also run around [`@On` event handlers](/docs/4.1/gateway-events#gateway-events). Like a guard, an interceptor can be limited to some context types: `@Interceptor({ types: ['interaction', 'message'] })`.

Generate one with `npx meocord g i <name>`.

---
