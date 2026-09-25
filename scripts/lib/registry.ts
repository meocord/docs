/**
 * The public npm registry, read without npm: a package's packument, and a version's tarball held in
 * memory only once its bytes match the sha512 the registry published for it.
 */

import { createHash } from 'crypto'

export const REGISTRY = 'https://registry.npmjs.org'

export type Fetch = (url: string) => Promise<Response>

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

export function fetchPackument(name: string, fetchImpl: Fetch = fetch): Promise<Packument> {
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
  fetchImpl: Fetch = fetch,
): Promise<VerifiedTarball> {
  const entry = packument.versions[version]
  if (!entry) throw new Error(`${packument.name}@${version} is not published.`)
  const response = await fetchImpl(entry.dist.tarball)
  if (!response.ok) throw new Error(`GET ${entry.dist.tarball} answered ${response.status}.`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  return { bytes, sha512: checkIntegrity(bytes, entry.dist.integrity) }
}
