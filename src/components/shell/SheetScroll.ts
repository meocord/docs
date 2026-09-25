'use client'

import { useEffect } from 'react'

/** Where each page's sheet was left, so going back returns to it. */
const positions = new Map<string, number>()
let returning = false
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

// The keys a reader scrolls with, and how far each moves the sheet.
const KEYS: Record<string, (sheet: HTMLElement, shift: boolean) => ScrollToOptions> = {
  ' ': (sheet, shift) => ({ top: sheet.scrollTop + (shift ? -1 : 1) * sheet.clientHeight * 0.85 }),
  PageDown: sheet => ({ top: sheet.scrollTop + sheet.clientHeight * 0.85 }),
  PageUp: sheet => ({ top: sheet.scrollTop - sheet.clientHeight * 0.85 }),
  ArrowDown: sheet => ({ top: sheet.scrollTop + 40 }),
  ArrowUp: sheet => ({ top: sheet.scrollTop - 40 }),
  Home: () => ({ top: 0 }),
  End: sheet => ({ top: sheet.scrollHeight }),
}

/**
 * Makes the reading sheet behave as the window's scroller where it is one, on a desktop. A key that
 * would scroll the page scrolls the sheet and hands it focus, so the next key scrolls it natively. A
 * page opened by going back returns to where the sheet was; any other opens at its top, or at its
 * anchor.
 */
export function SheetScroll() {
  useEffect(() => {
    // The page on show: Next keeps a page it navigated away from, hidden, beside it.
    const sheet = [...document.querySelectorAll<HTMLElement>('[data-sheet]')].find(el => el.checkVisibility())
    if (!sheet) return
    const scrolls = () => getComputedStyle(sheet).overflowY === 'auto'
    // Each page draws its own window, and one kept from before runs this again when it returns.
    const key = location.pathname

    // A page kept from before comes back where it was; one rendered afresh is put there.
    if (returning) sheet.scrollTop ||= positions.get(key) ?? 0
    else if (!location.hash) sheet.scrollTop = 0
    returning = false

    const onScroll = () => positions.set(key, sheet.scrollTop)
    const onKey = (event: KeyboardEvent) => {
      const move = KEYS[event.key]
      if (!move || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target !== document.body || !scrolls()) return
      event.preventDefault()
      sheet.focus({ preventScroll: true })
      sheet.scrollTo({ ...move(sheet, event.shiftKey), behavior: 'auto' })
    }
    sheet.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('keydown', onKey)
    return () => {
      sheet.removeEventListener('scroll', onScroll)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  return null
}
