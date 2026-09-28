/**
 * `node:async_hooks` for the playground's Worker: an AsyncLocalStorage whose store follows every
 * continuation. The runtime bundle and the reader's code are compiled with async/await lowered to
 * generators on `Promise.prototype.then`, so patching `then`, the timers and `queueMicrotask` to restore
 * the context each callback was registered in carries it wherever MeoCord needs it: the call's theme,
 * its guard params, its context. It runs only in the Worker, never on a docs page.
 */

type Context = Map<object, unknown>
type Callback = (...args: never[]) => unknown

let context: Context = new Map()

/** A function that runs in the context that was current when it was bound. */
function bind<T>(fn: T): T {
  if (typeof fn !== 'function') return fn
  const captured = context
  return function (this: unknown, ...args: unknown[]) {
    const previous = context
    context = captured
    try {
      return (fn as unknown as (...rest: unknown[]) => unknown).apply(this, args)
    } finally {
      context = previous
    }
  } as T
}

const then = Promise.prototype.then
Promise.prototype.then = function (this: Promise<unknown>, onFulfilled?: unknown, onRejected?: unknown) {
  return then.call(this, bind(onFulfilled) as never, bind(onRejected) as never)
} as typeof Promise.prototype.then

const timers = globalThis as unknown as Record<
  'setTimeout' | 'setInterval',
  (fn: Callback, ...rest: unknown[]) => unknown
>
for (const name of ['setTimeout', 'setInterval'] as const) {
  const original = timers[name].bind(globalThis)
  timers[name] = (fn, ...rest) => original(bind(fn), ...rest)
}
const microtask = globalThis.queueMicrotask.bind(globalThis)
globalThis.queueMicrotask = fn => microtask(bind(fn))

export class AsyncLocalStorage<T> {
  run<R>(store: T, fn: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = context
    context = new Map(previous).set(this, store)
    try {
      return fn(...args)
    } finally {
      context = previous
    }
  }

  exit<R>(fn: (...args: unknown[]) => R, ...args: unknown[]): R {
    const previous = context
    context = new Map(previous)
    context.delete(this)
    try {
      return fn(...args)
    } finally {
      context = previous
    }
  }

  getStore(): T | undefined {
    return context.get(this) as T | undefined
  }

  enterWith(store: T): void {
    context = new Map(context).set(this, store)
  }

  disable(): void {}
}

export class AsyncResource {
  static bind<F>(fn: F): F {
    return bind(fn)
  }
}

export default { AsyncLocalStorage, AsyncResource }
