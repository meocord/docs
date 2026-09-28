/**
 * What a built page would load from another origin, which its policy refuses: the page policy allows
 * `'self'` for everything, and `data:` for images, so a subresource elsewhere is a broken image or a
 * blocked script and a console error. Checked after the build, over every page, whatever made it.
 */

/** The elements that load what their `src` names, and the other attributes that load a URL. */
const LOADING_TAGS = /<(img|script|iframe|frame|video|audio|source|track|embed|input)\b([^>]*)>/gi
const LOADING_ATTRIBUTES = /\b(src|srcset|poster)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi

/** A `<link>` whose `href` the browser fetches, as a stylesheet, a preload or an icon does; a canonical doesn't. */
const LINK = /<link\b([^>]*)>/gi
const LOADING_RELS = /^(?:stylesheet|preload|modulepreload|prefetch|icon|shortcut icon|apple-touch-icon|manifest)$/i

/** An `<object>`'s `data`, and any `url(…)` in a stylesheet or a style attribute; a page's text may quote one. */
const OBJECT = /<object\b[^>]*\bdata\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi
const STYLES = /<style\b[^>]*>([\s\S]*?)<\/style>|\bstyle\s*=\s*("[^"]*"|'[^']*')/gi
const CSS_URL = /url\(\s*(["']?)([^"')]*)\1\s*\)/gi

const unquote = (value: string) => value.replace(/^["']|["']$/g, '')
const attribute = (attributes: string, name: string) =>
  new RegExp(`\\b${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, 'i').exec(attributes)?.[1]

/** Whether a URL leaves the page's origin: it names a scheme other than `data:`, or starts with `//`. */
export function isForeign(url: string): boolean {
  const trimmed = url.trim()
  if (/^data:/i.test(trimmed)) return false
  return /^[a-z][a-z\d+.-]*:/i.test(trimmed) || trimmed.startsWith('//')
}

/** Each URL `html` would load from another origin, as `<tag attribute="url">`. */
export function foreignResources(html: string): string[] {
  const found: string[] = []
  // Script bodies are code, not markup: an URL in a string there loads nothing
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, '$1</script>')
  for (const [, tag, attributes] of markup.matchAll(LOADING_TAGS))
    for (const [, name, value] of attributes.matchAll(LOADING_ATTRIBUTES)) {
      // A srcset lists candidates, each a URL and a size
      const urls =
        name.toLowerCase() === 'srcset'
          ? unquote(value)
              .split(',')
              .map(each => each.trim().split(/\s+/)[0])
          : [unquote(value)]
      for (const url of urls)
        if (url && isForeign(url)) found.push(`<${tag.toLowerCase()} ${name.toLowerCase()}="${url}">`)
    }
  for (const [, attributes] of markup.matchAll(LINK)) {
    const rel = attribute(attributes, 'rel')
    const href = attribute(attributes, 'href')
    if (rel && href && LOADING_RELS.test(unquote(rel).trim()) && isForeign(unquote(href)))
      found.push(`<link rel="${unquote(rel)}" href="${unquote(href)}">`)
  }
  for (const [, value] of markup.matchAll(OBJECT))
    if (isForeign(unquote(value))) found.push(`<object data="${unquote(value)}">`)
  for (const [, sheet, inline] of markup.matchAll(STYLES))
    for (const [, , url] of (sheet ?? unquote(inline ?? '')).matchAll(CSS_URL))
      if (isForeign(url)) found.push(`url(${url})`)
  return found
}
