'use client'

import { useLayoutEffect, useRef } from 'react'
import { Component, Span } from '@meonode/ui'
import { DOC_ALIASES } from '@/config/aliases'

/** How far each line's sidebar was scrolled, so a page that draws its own opens it there. */
const offsets = new Map<string, number>()
/**
 * Where each sidebar Next keeps was left, to put it back there on Back or Forward: a kept page is hidden
 * meanwhile, and a hidden scroller does not keep its position.
 */
const places = new WeakMap<Element, number>()

/** Room kept above or below the current link when it is scrolled into view. */
const MARGIN = 24

/** The history entries each sidebar was shown at, by the key this component gives each entry. */
const shownAt = new WeakMap<Element, Set<string>>()

/** Where this component keeps its key in an entry's `history.state`, beside the router's own fields. */
const ENTRY_KEY = 'meocordDocsEntry'

/**
 * The current history entry's key: one of this component's own, kept in the entry's state, and given
 * to an entry the first time a sidebar is shown at it. Back and Forward bring the entry's state back
 * with it, so the key needs no event and no Navigation API.
 */
function entryKey(): string {
  const state: Record<string, unknown> = history.state ?? {}
  const kept = state[ENTRY_KEY]
  if (typeof kept === 'string') return kept
  const key = crypto.randomUUID()
  history.replaceState({ ...state, [ENTRY_KEY]: key }, '')
  return key
}

/**
 * Whether a sidebar is being shown again by Back or Forward: at a history entry it was shown at before.
 * A new visit, by a link or search, always makes a new entry.
 */
function returning(body: Element): boolean {
  const key = entryKey()
  const entries = shownAt.get(body) ?? new Set<string>()
  const seen = entries.has(key)
  shownAt.set(body, entries.add(key))
  return seen
}

/**
 * Keeps the sidebar's place as the reader moves between pages. Every page draws its own window, and Next
 * keeps the pages already read. A page reached by Back or Forward shows its sidebar exactly where it was
 * left, even where that hides the current link. Any other visit, by a link or search, opens the sidebar
 * where the line's sidebar was last left, before it is painted, and scrolls the current link into view
 * if it is outside the visible part, unless the reader has already scrolled it.
 */
export const SidebarScroll = Component(function SidebarScroll() {
  const anchor = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const body = anchor.current?.closest<HTMLElement>('[data-sidebar-body]')
    if (!body) return
    // The docs line, the second segment of /docs/<line>/…, latest read as the line it is, so one line keeps one place
    // whichever URL reached it; every other page shares one place.
    const segment = location.pathname.split('/')[2] ?? ''
    const line = segment === 'latest' ? DOC_ALIASES.latest : segment

    const left = places.get(body)
    // Shown for the first time yet already scrolled: the reader moved it before the page hydrated
    const readerMoved = !shownAt.has(body) && body.scrollTop !== 0
    if (returning(body) && left !== undefined) body.scrollTop = left
    else if (!readerMoved) {
      body.scrollTop = offsets.get(line) ?? 0
      const current = body.querySelector<HTMLElement>('[aria-current="page"]')
      if (current) {
        const view = body.getBoundingClientRect()
        const link = current.getBoundingClientRect()
        // Below the room the link keeps at the top, which the pinned filter takes
        const top = view.top + parseFloat(getComputedStyle(current).scrollMarginTop)
        if (link.top < top) body.scrollTop -= top - link.top + MARGIN
        else if (link.bottom > view.bottom) body.scrollTop += link.bottom - view.bottom + MARGIN
      }
    }
    const remember = () => {
      // Hidden, the scroller reads 0; that is not where the reader left it.
      if (body.clientHeight === 0) return
      offsets.set(line, body.scrollTop)
      places.set(body, body.scrollTop)
    }
    remember()
    body.addEventListener('scroll', remember, { passive: true })
    // Also as the page is left, in case its last scroll has not been heard yet.
    return () => {
      remember()
      body.removeEventListener('scroll', remember)
    }
  }, [])

  return Span(null, { ref: anchor, hidden: true })
})
