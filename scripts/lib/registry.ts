/**
 * The public npm registry, read without npm: a package's packument, and a version's tarball held in
 * memory only once its bytes match the sha512 the registry published for it.
 */

import { createHash } from 'crypto'

export const REGISTRY = 'https://registry.npmjs.org'

export type Fetch = (url: string) => Promise<Response>

/** How many times a request is tried while it fails with a network error, a 5xx or a 429. */
export const FETCH_ATTEMPTS = 3
/** The wait before the second attempt; each later wait doubles it. */
export const RETRY_BASE_DELAY_MS = 1000
/** How long one request may take before it counts as a network error. */
export const REQUEST_TIMEOUT_MS = 30_000

const TOO_MANY_REQUESTS = 429
const FIRST_SERVER_ERROR = 500

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

/**
 * `fetchImpl`, tried up to FETCH_ATTEMPTS times while it fails with a network error, a 5xx or a 429, waiting
 * RETRY_BASE_DELAY_MS before the second attempt and twice as long before each later one. Any other answer, a 404
 * included, returns at once; the last attempt's answer or error is what the caller gets. It covers a request up to its
 * response headers: a reset or a timeout while the caller reads the body, a tarball or JSON, is not tried again.
 */
export function withRetry(fetchImpl: Fetch, sleep: (ms: number) => Promise<void> = wait): Fetch {
  return async url => {
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetchImpl(url)
        const retriable = response.status === TOO_MANY_REQUESTS || response.status >= FIRST_SERVER_ERROR
        if (!retriable || attempt === FETCH_ATTEMPTS) return response
        await response.body?.cancel()
      } catch (error) {
        if (attempt === FETCH_ATTEMPTS) throw error
      }
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1))
    }
  }
}

/**
 * Every registry read's default: the global fetch, each request bounded by REQUEST_TIMEOUT_MS, body included, with
 * withRetry's retries up to the response headers.
 */
export const registryFetch: Fetch = withRetry(url => fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }))

export interface Dist {
  tarball: string
  integrity: string
}

export interface Packument {
  name: string
  'dist-tags': Record<string, string>
  versions: Record<string, { version: string; dist: Dist; deprecated?: string }>
  time?: Record<string, string>
}

async function getJson<T>(fetchImpl: Fetch, url: string): Promise<T> {
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`GET ${url} answered ${response.status}.`)
  return (await response.json()) as T
}

export function fetchPackument(name: string, fetchImpl: Fetch = registryFetch): Promise<Packument> {
  return getJson<Packument>(fetchImpl, `${REGISTRY}/${encodeURIComponent(name).replace('%40', '@')}`)
}

/**
 * The tarball's sha512, as hex, once it matches `integrity`. Only a sha512 integrity is accepted:
 * it is what the provenance statement's subject names.
 */
export function checkIntegrity(bytes: Uint8Array, integrity: string): string {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity.trim())
  if (!match) throw new Error(`Refusing integrity "${integrity}": only a single sha512 digest is accepted.`)
  const digest = createHash('sha512').update(bytes).digest()
  if (digest.toString('base64') !== match[1]) {
    throw new Error(`The tarball does not match its registry integrity (expected ${integrity}).`)
  }
  return digest.toString('hex')
}

export interface VerifiedTarball {
  bytes: Uint8Array
  /** The tarball's sha512, as hex, checked against the registry's integrity. */
  sha512: string
}

/** Downloads a version's tarball and returns it only if it matches the registry's integrity. */
export async function downloadTarball(
  packument: Packument,
  version: string,
  fetchImpl: Fetch = registryFetch,
): Promise<VerifiedTarball> {
  const entry = packument.versions[version]
  if (!entry) throw new Error(`${packument.name}@${version} is not published.`)
  const response = await fetchImpl(entry.dist.tarball)
  if (!response.ok) throw new Error(`GET ${entry.dist.tarball} answered ${response.status}.`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { bytes, sha512: checkIntegrity(bytes, entry.dist.integrity) }
}
