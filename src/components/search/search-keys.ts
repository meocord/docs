/**
 * The search field's stand-in: a plain input, drawn where the palette's field opens, that holds what
 * the reader types until the palette is ready. The browser edits it, so every key, paste and input
 * method works as in any field. It shows while `<html>` carries `data-search-early`.
 */

/** The stand-in's input, which keeps what had focus before it opened, to hand focus back to. */
type StandIn = HTMLInputElement & { returnTo?: Element | null }
const standIn = () => document.querySelector<StandIn>('[data-search-stand-in]')

/** Opens the stand-in and gives it focus; the island calls it for a shortcut while the palette loads. */
export function openStandIn() {
  const input = standIn()
  if (!input) return false
  document.documentElement.setAttribute('data-search-early', '')
  input.returnTo = document.activeElement
  input.focus()
  return true
}

/** Whether the stand-in is open: the reader has not closed it since it opened. */
export const standInOpen = () => document.documentElement.hasAttribute('data-search-early')

/** What had focus before the stand-in opened, where the palette hands focus back as it closes. */
export const standInReturnTo = () => standIn()?.returnTo

/** Closes the stand-in and empties it; with `refocus`, focus goes back to what had it before. */
export function closeStandIn(refocus = true) {
  document.documentElement.removeAttribute('data-search-early')
  const input = standIn()
  if (!input) return
  input.value = ''
  const back = input.returnTo
  if (refocus && back instanceof HTMLElement && back.isConnected) back.focus()
  else input.blur()
}

/** What the stand-in holds, with its selection, as the palette takes it over; the stand-in closes. */
export function takeStandIn(): { text: string; start: number; end: number } | undefined {
  const input = standIn()
  const taken = input && standInOpen() ? input : undefined
  const text = taken?.value ?? ''
  const result = taken && { text, start: taken.selectionStart ?? text.length, end: taken.selectionEnd ?? text.length }
  // The palette's field has focus by now, and keeps it
  closeStandIn(false)
  return result
}

/**
 * Opens the stand-in for the palette's shortcut, ⌘K, Ctrl-K or `/` outside a field, pressed before
 * the search island listens, and closes it as the palette would: on Escape, or a press outside it.
 * While it is open a repeated shortcut is taken and Tab stays in it. It runs as an inline script from
 * the first paint; once the island listens, it takes the shortcut first, and this only closes.
 */
function searchKeys() {
  const root = document.documentElement
  const field = () => document.querySelector<HTMLInputElement & { returnTo?: Element | null }>('[data-search-stand-in]')
  const close = () => {
    root.removeAttribute('data-search-early')
    const input = field()
    if (!input) return
    input.value = ''
    const back = input.returnTo
    if (back instanceof HTMLElement && back.isConnected) back.focus()
    else input.blur()
  }
  // On the window, and before the page keys' script, so a key the page took, or one for the field, is left.
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented) return
    const shortcut = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey
    if (root.hasAttribute('data-search-early')) {
      if (event.key === 'Escape') close()
      if (shortcut || event.key === 'Escape' || event.key === 'Tab') event.preventDefault()
      return
    }
    const target = event.target instanceof HTMLElement ? event.target : null
    const typing = !!target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing
    const input = field()
    if ((!shortcut && !slash) || !input) return
    event.preventDefault()
    root.setAttribute('data-search-early', '')
    input.returnTo = document.activeElement
    input.focus()
  })
  document.addEventListener(
    'pointerdown',
    event => {
      const inside = event.target instanceof Element && event.target.closest('[data-search-stand-in-panel]')
      if (root.hasAttribute('data-search-early') && !inside) close()
    },
    true,
  )
}

/** The inline script that runs {@link searchKeys}; it holds no reference outside the function. */
export const SEARCH_KEYS_SCRIPT = `(${searchKeys.toString()})()`
