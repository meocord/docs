'use client'

import { useEffect, useRef } from 'react'
import { Component, usePortal } from '@meonode/ui'
import type { SearchLine } from '@/lib/search-manifest'
import { closeStandIn, openStandIn, standInOpen, standInReturnTo, takeStandIn } from '@/components/search/search-keys'

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
 * no field has focus. Until the palette is ready, what the reader types goes into its stand-in
 * (`SearchStandIn`), which an inline script opens for a shortcut pressed before the island listens.
 * The palette's code loads once the page is idle after load, or sooner when the reader points at or
 * focuses the search field; the line's search index loads at the first open.
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
    const show = async () => {
      if (open.current || lines.length === 0) return
      open.current = true
      // What the reader types while the palette loads goes into the stand-in, which the browser edits.
      const holding = standInOpen() || openStandIn()
      const loaded = await loadPalette().catch(() => undefined)
      // A failed load, or a stand-in the reader closed meanwhile: the keys are the page's, and the next open tries again.
      if (!loaded || (holding && !standInOpen())) {
        open.current = false
        closeStandIn()
        return
      }
      portal.open(loaded.PaletteLayer, {
        lines,
        typed: takeStandIn,
        // Focus goes back where it was before the stand-in took it, not to the stand-in.
        returnTo: standInReturnTo(),
        closed: () => (open.current = false),
      })
    }
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-search-trigger]')) return
      event.preventDefault()
      void show()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey) && !event.altKey
      const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !typing(event.target)
      if (!shortcut && !slash) return
      event.preventDefault()
      void show()
    }
    document.addEventListener('click', onClick)
    document.addEventListener('keydown', onKeyDown)
    // A shortcut pressed before the island listened left the stand-in open: the palette takes it over.
    if (standInOpen()) {
      if (lines.length === 0) closeStandIn()
      else void show()
    }
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [lines, portal])

  return null
})
