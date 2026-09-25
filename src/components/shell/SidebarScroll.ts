'use client'

import { useLayoutEffect, useRef } from 'react'
import { Component, Span } from '@meonode/ui'

/** How far each line's sidebar was scrolled, so a page that draws its own opens it there. */
const offsets = new Map<string, number>()
/** The sidebars already put in place: one Next kept from before comes back as it was left. */
const placed = new WeakSet<Element>()

/** Room kept above or below the current link when it is scrolled into view. */
const MARGIN = 24

/**
 * Keeps the sidebar's place as the reader moves between pages. Every page draws its own window, so a
 * new page brings a new sidebar: it opens where the line's sidebar was last left, before it is painted.
 * A page kept from before, reached by going back, keeps its own place. The current link is then scrolled
 * into view, only if it is outside the visible part.
 */
export const SidebarScroll = Component(function SidebarScroll() {
  const anchor = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const body = anchor.current?.closest<HTMLElement>('[data-sidebar-body]')
    if (!body) return
    // The docs line, the second segment of /docs/<line>/…; every other page shares one place.
    const line = location.pathname.split('/')[2] ?? ''

    if (!placed.has(body)) {
      placed.add(body)
      body.scrollTop = offsets.get(line) ?? 0
    }
    const current = body.querySelector<HTMLElement>('[aria-current="page"]')
    if (current) {
      const view = body.getBoundingClientRect()
      const link = current.getBoundingClientRect()
      if (link.top < view.top) body.scrollTop -= view.top - link.top + MARGIN
      else if (link.bottom > view.bottom) body.scrollTop += link.bottom - view.bottom + MARGIN
    }
    offsets.set(line, body.scrollTop)

    const onScroll = () => offsets.set(line, body.scrollTop)
    body.addEventListener('scroll', onScroll, { passive: true })
    return () => body.removeEventListener('scroll', onScroll)
  }, [])

  return Span(null, { ref: anchor, hidden: true })
})
