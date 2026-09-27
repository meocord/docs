/** Where the inline script keeps an early open's keys for the search island: `null` once the island listens. */
interface EarlySearch {
  __earlySearch?: string[] | null
}

/**
 * Remembers the palette's shortcut, ⌘K, Ctrl-K or `/` outside a field, pressed before the search island
 * listens, and the keys typed after it, so the palette opens with them once it does. It runs as an
 * inline script from the first paint, and stands down when the island takes over.
 */
function searchKeys() {
  // On the window, and before the page keys' script, so a key typed for the palette never scrolls the page.
  window.addEventListener('keydown', event => {
    const early = window as EarlySearch
    if (early.__earlySearch === null || event.defaultPrevented) return
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey
    if (early.__earlySearch) {
      if (plain && event.key.length === 1) {
        event.preventDefault()
        early.__earlySearch.push(event.key)
      }
      return
    }
    const target = event.target instanceof HTMLElement ? event.target : null
    const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    const shortcut = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey
    if (!shortcut && !(event.key === '/' && plain && !typing)) return
    event.preventDefault()
    early.__earlySearch = []
  })
}

/** The inline script that runs {@link searchKeys}; it holds no reference outside the function. */
export const SEARCH_KEYS_SCRIPT = `(${searchKeys.toString()})()`

/**
 * Hands the search island what the inline script remembered, and stands the script down: the keys
 * typed after an early shortcut, or `undefined` when there was none.
 */
export function takeEarlySearch(): string[] | undefined {
  const early = window as EarlySearch
  const typed = early.__earlySearch ?? undefined
  early.__earlySearch = null
  return typed
}
