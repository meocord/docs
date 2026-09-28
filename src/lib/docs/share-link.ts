import { deflateRawSync } from 'node:zlib'
import { SHARE_FORMAT, type Shared } from '@/playground/share'

/**
 * A share link's fragment written at build, where rendering is synchronous: the format the browser's
 * `encodeShared` writes and `decodeShared` reads, from Node's zlib.
 */
export function sharedFragment(shared: Shared): string {
  const json = JSON.stringify({ source: shared.source, dispatch: shared.dispatch })
  return `${SHARE_FORMAT}.${deflateRawSync(Buffer.from(json), { level: 9 }).toString('base64url')}`
}
