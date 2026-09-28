import { deflateRawSync } from 'node:zlib'
import { MAX_SHARED_LENGTH, SHARE_FORMAT, type Shared, tooLongToShare } from '@/playground/share'

/**
 * A share link's fragment written at build, where rendering is synchronous: the format the browser's
 * `encodeShared` writes and `decodeShared` reads, from Node's zlib. One longer than a link carries fails
 * the build, naming `name`.
 */
export function sharedFragment(shared: Shared, name = 'a playground'): string {
  const json = JSON.stringify({ source: shared.source, dispatch: shared.dispatch })
  const fragment = `${SHARE_FORMAT}.${deflateRawSync(Buffer.from(json), { level: 9 }).toString('base64url')}`
  // A link the page would refuse to read is never written: the example is shortened instead
  if (tooLongToShare(fragment))
    throw new Error(
      `${name} is too long for its "Open in playground" link: ${fragment.length - SHARE_FORMAT.length - 1} characters encoded, over the ${MAX_SHARED_LENGTH.toLocaleString('en')} a link carries.`,
    )
  return fragment
}
