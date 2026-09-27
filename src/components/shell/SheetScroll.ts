'use client'

import { useEffect } from 'react'

/** Where each page's sheet was left, so going back returns to it. */
const positions = new Map<string, number>()
let returning = false
// Whether a page has opened in this document: the first one's sheet starts at its top, and the page keys
// may have moved it before it hydrates.
let opened = false
// Heard as the traversal starts, before the router renders the page it returns to; popstate where the
// Navigation API is missing.
if (typeof window !== 'undefined') {
  const navigation = (window as { navigation?: EventTarget }).navigation
  if (navigation)
    navigation.addEventListener('navigate', event => {
      // The router replaces the entry it returns to, which leaves a traversal a traversal.
      const type = (event as Event & { navigationType: string }).navigationType
      if (type !== 'replace') returning = type === 'traverse'
    })
  else window.addEventListener('popstate', () => (returning = true), { capture: true })
}

/**
 * Puts the reading sheet where the reader expects it, as the window's scroller would be. A page opened
 * by going back returns to where the sheet was; one a link opens starts at its top, or at its anchor.
 * The page keys that scroll it are `sheet-keys.ts`, an inline script.
 */
export function SheetScroll() {
  useEffect(() => {
    // The page on show: Next keeps a page it navigated away from, hidden, beside it.
    const sheet = [...document.querySelectorAll<HTMLElement>('[data-sheet]')].find(el => el.checkVisibility())
    if (!sheet) return
    // Each page draws its own window, and one kept from before runs this again when it returns.
    const key = location.pathname

    // A page kept from before comes back where it was; one a link opened is put there.
    if (returning) sheet.scrollTop ||= positions.get(key) ?? 0
    else if (opened && !location.hash) sheet.scrollTop = 0
    returning = false
    opened = true

    const onScroll = () => positions.set(key, sheet.scrollTop)
    sheet.addEventListener('scroll', onScroll, { passive: true })
    return () => sheet.removeEventListener('scroll', onScroll)
  }, [])
  return null
}
