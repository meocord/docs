/** `node:timers/promises` over the Worker's timers. */
export const setTimeout = <T>(ms?: number, value?: T) =>
  new Promise<T | undefined>(resolve => globalThis.setTimeout(() => resolve(value), ms))
export const setImmediate = <T>(value?: T) => Promise.resolve(value)

export default { setTimeout, setImmediate }
