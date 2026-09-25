import http from 'node:http'
import type { AddressInfo } from 'node:net'
import type { Page } from '@playwright/test'

/**
 * Serving a page in two parts, as a slow network can deliver it: the HTML up to a cut, then, after a
 * hold, the rest. A browser paints what it has in between, so anything the rest of the page moves shows
 * up as a layout shift. It is how a shift that depends on where the network happens to split the HTML
 * is caught every time.
 */

/** Where to cut: just after the opening tag of the first element matching `selector`, or after its end. */
export interface Cut {
  selector: string
  at: 'open' | 'close'
}

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'wbr'])

/** A compound selector of a tag, an #id and [attribute] or [attribute="value"] parts. */
function matcher(selector: string) {
  const tag = /^[a-z][a-z0-9-]*/i.exec(selector)?.[0]?.toLowerCase()
  const id = /#([\w-]+)/.exec(selector)?.[1]
  const attributes = [...selector.matchAll(/\[([\w:-]+)(?:="([^"]*)")?\]/g)].map(([, name, value]) => ({ name, value }))
  if (!tag && !id && attributes.length === 0) throw new Error(`Cannot cut at "${selector}".`)
  return (name: string, attrs: Map<string, string>) =>
    (!tag || name === tag) &&
    (!id || attrs.get('id') === id) &&
    attributes.every(({ name: key, value }) => attrs.has(key) && (value === undefined || attrs.get(key) === value))
}

/** The offset in `html` to cut at, or throws when nothing matches. */
export function cutOffset(html: string, { selector, at }: Cut): number {
  const matches = matcher(selector)
  const TAG = /<(\/?)([a-z][a-z0-9-]*)([^>]*)>/gi
  let found: { name: string; end: number } | undefined
  for (let tag = TAG.exec(html); tag; tag = TAG.exec(html)) {
    if (tag[1]) continue
    const name = tag[2].toLowerCase()
    const attrs = new Map(
      [...tag[3].matchAll(/([\w:-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].map(m => [
        m[1],
        m[2] ?? m[3] ?? m[4] ?? '',
      ]),
    )
    if (matches(name, attrs)) {
      found = { name, end: TAG.lastIndex }
      break
    }
  }
  if (!found) throw new Error(`No element matches "${selector}".`)
  if (at === 'open' || VOID.has(found.name)) return found.end
  // The matching close tag: the first that brings same-named nesting back to zero.
  const SAME = new RegExp(`<(/?)${found.name}\\b[^>]*>`, 'gi')
  SAME.lastIndex = found.end
  let depth = 1
  for (let tag = SAME.exec(html); tag; tag = SAME.exec(html)) {
    depth += tag[1] ? -1 : 1
    if (depth === 0) return SAME.lastIndex
  }
  throw new Error(`"${selector}" is never closed.`)
}

/**
 * A server in front of `baseURL` that sends `path` cut as `cut` says, holding the rest for `holdMs`, and
 * passes every other request through. Close it when done.
 */
export async function cutServer(baseURL: string, path: string, cut: Cut, holdMs = 1500) {
  const server = http.createServer(async (request, response) => {
    const upstream = await fetch(new URL(request.url ?? '/', baseURL), {
      headers: { 'accept-encoding': 'identity' },
      redirect: 'manual',
    })
    const headers: Record<string, string> = {}
    upstream.headers.forEach((value, key) => {
      if (!['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key)) headers[key] = value
    })
    const body = Buffer.from(await upstream.arrayBuffer())
    response.writeHead(upstream.status, headers)
    if (request.url !== path) return response.end(body)
    const html = body.toString('utf8')
    const offset = cutOffset(html, cut)
    response.write(html.slice(0, offset))
    setTimeout(() => response.end(html.slice(offset)), holdMs)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}${path}`,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  }
}

/** Starts recording a page's layout shifts; call before it loads. The result reads them. */
export async function recordShifts(page: Page) {
  await page.addInitScript(() => {
    const seen: { value: number; sources: string[] }[] = []
    ;(window as unknown as { __shifts: typeof seen }).__shifts = seen
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as unknown as {
        value: number
        sources: { node?: Node; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[]
      }[]) {
        seen.push({
          value: entry.value,
          sources: entry.sources.map(({ node, previousRect: a, currentRect: b }) => {
            // The element, named by its tag and its first data attribute, which is how the site marks its parts.
            const element = node instanceof Element ? node : node?.parentElement
            const data = element && [...element.attributes].find(attr => attr.name.startsWith('data-'))
            const name = element ? `${element.tagName.toLowerCase()}${data ? `[${data.name}]` : ''}` : '?'
            const box = (r: DOMRectReadOnly) => [r.x, r.y, r.width, r.height].map(Math.round).join(',')
            return `${name} [${box(a)}] to [${box(b)}]`
          }),
        })
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  return async () => {
    const shifts = await page.evaluate(
      () => (window as unknown as { __shifts: { value: number; sources: string[] }[] }).__shifts,
    )
    return { cls: shifts.reduce((sum, shift) => sum + shift.value, 0), moved: shifts.flatMap(shift => shift.sources) }
  }
}
