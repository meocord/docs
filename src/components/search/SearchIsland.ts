'use client'

import { useEffect, useRef } from 'react'
import { Component, usePortal } from '@meonode/ui'
import type { SearchLine } from '@/lib/search-manifest'

export interface SearchIslandProps {
  /** Every line's search bundle and palette index, from the build's search manifest. */
  lines: SearchLine[]
}

/** Whether a key press belongs to a field the reader is typing in. */
function typing(target: EventTarget | null): boolean {
  const element = target instanceof HTMLElement ? target : null
  return !!element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))
}

// The palette's module, loaded once; a failed load is forgotten so the next open tries again.
let palette: Promise<typeof import('@/components/search/Palette')> | undefined
function loadPalette() {
  palette ??= import('@/components/search/Palette').catch(error => {
    palette = undefined
    throw error
  })
  return palette
}

/** Loads the palette's module in the background, so the first open draws it at once. */
function warm() {
  loadPalette().catch(() => {})
}

/**
 * Opens the command palette from the toolbar's search field, from ⌘K or Ctrl-K, and from `/` when
 * no field has focus. The palette's code loads once the page is idle after load, or sooner when the
 * reader points at or focuses the search field; the line's search index loads at the first open.
 */
export const SearchIsland = Component<SearchIslandProps>(function SearchIsland({ lines }) {
  const portal = usePortal()
  const open = useRef(false)

  useEffect(() => {
    if (lines.length === 0) return
    let idle: number | undefined
    const schedule = () => {
      idle =
        typeof requestIdleCallback === 'function'
          ? requestIdleCallback(warm, { timeout: 4000 })
          : window.setTimeout(warm, 1000)
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    const onApproach = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[data-search-trigger]')) warm()
    }
    document.addEventListener('pointerover', onApproach)
    document.addEventListener('focusin', onApproach)
    return () => {
      window.removeEventListener('load', schedule)
      if (idle !== undefined) {
        if (typeof cancelIdleCallback === 'function') cancelIdleCallback(idle)
        else window.clearTimeout(idle)
      }
      document.removeEventListener('pointerover', onApproach)
      document.removeEventListener('focusin', onApproach)
    }
  }, [lines])

  useEffect(() => {
    // Keys typed while the palette is still loading, handed to its field so none is lost.
    let typed: string[] | undefined
    const buffer = (event: KeyboardEvent) => {
      if (typed && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        typed.push(event.key)
      }
    }
    const show = async () => {
      if (open.current || lines.length === 0) return
      open.current = true
      typed = []
      const loaded = await loadPalette().catch(() => undefined)
      if (!loaded) {
        // Keys go back to the page, and the next open tries again.
        open.current = false
        typed = undefined
        return
      }
      portal.open(loaded.PaletteLayer, {
        lines,
        typed: () => {
          const text = typed?.join('') ?? ''
          typed = undefined
          return text
        },
        closed: () => (open.current = false),
      })
    }
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-search-trigger]')) return
      event.preventDefault()
      void show()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      buffer(event)
      const shortcut = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing(event.target)
      if (!shortcut && !(slash && !typed)) return
      event.preventDefault()
      void show()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [lines, portal])

  return null
})
