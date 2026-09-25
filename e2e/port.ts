import { createHash } from 'node:crypto'

const FIRST = 4300
/** Even ports only, so the upstream at `port + 1` stays inside 4300–4899. */
const SLOTS = 300

/**
 * The port the e2e server listens on; its upstream takes the next one. `E2E_PORT` wins; otherwise a
 * stable hash of the checkout's path, so two checkouts running at once pick different ports.
 */
export function e2ePort(env: Record<string, string | undefined> = process.env, cwd = process.cwd()): number {
  if (env.E2E_PORT) {
    const port = Number(env.E2E_PORT)
    if (!Number.isInteger(port) || port < 1 || port > 65534) {
      throw new Error(`E2E_PORT must be a port from 1 to 65534, not '${env.E2E_PORT}'.`)
    }
    return port
  }
  const slot = createHash('sha256').update(cwd).digest().readUInt32BE(0) % SLOTS
  return FIRST + slot * 2
}
