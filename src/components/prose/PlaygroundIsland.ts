'use client'

import { useEffect } from 'react'

/**
 * The client side of a page's playgrounds. It draws nothing: it shows the Run buttons the server rendered
 * hidden, since they do nothing without script, and on the first press loads the runner, which embeds the
 * sandboxed frame and shows the result. Nothing of the playground loads before a reader presses Run.
 */
export function PlaygroundIsland() {
  useEffect(() => {
    const buttons = document.querySelectorAll<HTMLButtonElement>(
      '[data-playground-embed][data-playground-src] [data-playground-run]',
    )
    for (const button of buttons) button.hidden = false

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const button = target?.closest<HTMLButtonElement>('[data-playground-run]')
      const embed = button?.closest<HTMLElement>('[data-playground-embed][data-playground-src]')
      if (!button || !embed) return
      void import('@/playground/client/runner').then(({ runEmbed }) => runEmbed(embed, button))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])
  return null
}
