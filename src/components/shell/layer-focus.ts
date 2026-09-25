'use client'

import { type RefObject, useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Focus for an open layer: moves focus in when it opens, keeps Tab inside it, closes on Escape or a
 * press outside, and hands focus back to whatever had it when the layer closes.
 */
export function useLayerFocus(ref: RefObject<HTMLElement | null>, close: () => void) {
  // Read through a ref, so a new `close` each render does not re-run the effect and move focus again.
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    const dismiss = () => closeRef.current()
    const layer = ref.current
    if (!layer) return
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () => [...layer.querySelectorAll<HTMLElement>(FOCUSABLE)]
    ;(layer.querySelector<HTMLElement>('[aria-current="page"]') ?? focusables()[0] ?? layer).focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      } else if (event.key === 'Tab') {
        const items = focusables()
        if (items.length === 0) return event.preventDefault()
        const [first, last] = [items[0], items[items.length - 1]]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!layer.contains(event.target as Node)) dismiss()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
      if (returnTo?.isConnected) returnTo.focus()
    }
  }, [ref])
}

/** Arrow keys, Home and End move focus through a menu's items. */
export function moveMenuFocus(event: { key: string; preventDefault(): void }, menu: HTMLElement) {
  const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  if (items.length === 0) return
  const index = items.indexOf(document.activeElement as HTMLElement)
  const next = {
    ArrowDown: (index + 1) % items.length,
    ArrowUp: (index - 1 + items.length) % items.length,
    Home: 0,
    End: items.length - 1,
  }[event.key]
  if (next === undefined) return
  event.preventDefault()
  items[next].focus()
}
