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

/**
 * Opens the command palette from the toolbar's search field, from ⌘K or Ctrl-K, and from `/` when
 * no field has focus. The palette, and the line's search index, load at the first open, so a page
 * that is only read carries none of them.
 */
export const SearchIsland = Component<SearchIslandProps>(function SearchIsland({ lines }) {
  const portal = usePortal()
  const open = useRef(false)

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
      const loaded = await import('@/components/search/Palette').catch(() => undefined)
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
