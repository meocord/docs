/** `node:timers` over the Worker's own timers, which carry the async context. */
export const setTimeout = (...args: Parameters<typeof globalThis.setTimeout>) => globalThis.setTimeout(...args)
export const clearTimeout = (id?: number) => globalThis.clearTimeout(id)
export const setInterval = (...args: Parameters<typeof globalThis.setInterval>) => globalThis.setInterval(...args)
export const clearInterval = (id?: number) => globalThis.clearInterval(id)
export const setImmediate = (fn: (...args: unknown[]) => void, ...args: unknown[]) =>
  globalThis.setTimeout(fn, 0, ...args)
export const clearImmediate = clearTimeout

export default { setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate }
