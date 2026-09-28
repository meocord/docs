/**
 * A playground's code and inputs as a link's fragment, `#v1.<code>`: their JSON, deflated and written in
 * base64url. The same code runs at build, for each embed's "Open in playground" link, and in the browser.
 */
import { MAX_SOURCE_LENGTH } from './runtime/protocol'

/** What a link carries: the code, and the inputs as a `dispatch` attribute writes them. */
export interface Shared {
  source: string
  dispatch: string
}

/** The format a link's fragment is written in, its first part: a change to the format is a new one. */
export const SHARE_FORMAT = 'v1'
const PREFIX = `${SHARE_FORMAT}.`

/**
 * The most a link's encoded code may be, in characters: a typical example is about 600 and the longest
 * 4.1 example about 1,300, and a link this long still fits in a Discord message with its address.
 */
export const MAX_SHARED_LENGTH = 1_800

/** The most a link may decode to, the most a run takes and some for the inputs. */
const MAX_DECODED_LENGTH = MAX_SOURCE_LENGTH + 4_000

const toBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (text: string) => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, char => char.charCodeAt(0))
}

async function drain(stream: ReadableStream<Uint8Array>, limit = Infinity): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = []
  let length = 0
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
    if (length > limit) {
      await reader.cancel()
      return undefined
    }
    chunks.push(value)
  }
  const out = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.byteLength
  }
  return out
}

/** The fragment, without its `#`, that carries `shared`. */
export async function encodeShared(shared: Shared): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify({ source: shared.source, dispatch: shared.dispatch }))
  const deflated = await drain(new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw')))
  return PREFIX + toBase64Url(deflated!)
}

/**
 * The code and inputs a fragment carries, or undefined when it carries none it can read: another format,
 * damaged data, a fragment longer than a link carries, or more than a run takes, which it stops
 * decompressing at.
 */
export async function decodeShared(fragment: string): Promise<Shared | undefined> {
  const text = fragment.replace(/^#/, '')
  // Nothing longer than a link can be shared is read: a decompressor may hand over its whole output at once,
  // WebKit's among them, so only the input's length bounds what decoding allocates
  if (text.length > PREFIX.length + MAX_SHARED_LENGTH) return undefined
  if (!text.startsWith(PREFIX) || !/^[\w-]+$/.test(text.slice(PREFIX.length))) return undefined
  try {
    const bytes = fromBase64Url(text.slice(PREFIX.length))
    const inflated = await drain(
      new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')),
      MAX_DECODED_LENGTH * 4,
    )
    if (!inflated) return undefined
    const value = JSON.parse(new TextDecoder().decode(inflated)) as unknown
    if (typeof value !== 'object' || value === null) return undefined
    const { source, dispatch } = value as Record<string, unknown>
    if (typeof source !== 'string' || typeof dispatch !== 'string') return undefined
    if (source.length > MAX_SOURCE_LENGTH || dispatch.length > 4_000) return undefined
    return { source, dispatch }
  } catch {
    return undefined
  }
}

/** Why `fragment` is too long to share, or undefined when it fits. */
export function tooLongToShare(fragment: string): string | undefined {
  const length = fragment.length - PREFIX.length
  if (length <= MAX_SHARED_LENGTH) return undefined
  return `This code is too long to share as a link (${length.toLocaleString('en')} characters encoded; a link carries up to ${MAX_SHARED_LENGTH.toLocaleString('en')}, so it fits in a Discord message). Copy the code instead, or shorten it.`
}
