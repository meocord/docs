'use client'

import { useEffect } from 'react'

/** The package managers a reader can choose, as the pre-paint script accepts them. */
const MANAGERS = ['npm', 'bun', 'pnpm', 'yarn']

/**
 * The reading page's one client island. It draws nothing: it listens on the document for the copy
 * buttons and package-manager tabs the server rendered, and marks the table of contents' current
 * heading as the reader scrolls.
 */
export function ReadingIsland() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const copy = target?.closest<HTMLButtonElement>('[data-copy]')
      if (copy) {
        // The pane on show: an install block has one per package manager.
        const code = [...(copy.closest('[data-code]')?.querySelectorAll('pre') ?? [])].find(
          pre => pre.offsetParent !== null,
        )
        if (!code) return
        void navigator.clipboard?.writeText(code.innerText.replace(/\n$/, '')).then(() => {
          copy.setAttribute('data-copied', '')
          copy.setAttribute('aria-label', 'Copied')
          window.setTimeout(() => {
            copy.removeAttribute('data-copied')
            copy.setAttribute('aria-label', 'Copy code')
          }, 1500)
        })
        return
      }
      const pm = target?.closest('[data-pm-choice]')?.getAttribute('data-pm-choice')
      if (pm && MANAGERS.includes(pm)) {
        document.documentElement.setAttribute('data-pm', pm)
        try {
          localStorage.setItem('pm', pm)
        } catch {
          // Storage can be unavailable; the choice then lasts for this page only.
        }
      }
    }

    // The current heading is the last one above a line 30% down the viewport, or the first.
    const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-toc]')]
    const headings = links.map(link => document.getElementById(link.dataset.toc ?? '')).filter(Boolean) as HTMLElement[]
    let frame = 0
    const track = () => {
      frame = 0
      const line = window.innerHeight * 0.3
      const current = headings.filter(heading => heading.getBoundingClientRect().top <= line).at(-1) ?? headings[0]
      for (const link of links) {
        if (link.dataset.toc === current?.id) link.setAttribute('aria-current', 'location')
        else link.removeAttribute('aria-current')
      }
    }
    const onScroll = () => {
      frame ||= window.requestAnimationFrame(track)
    }

    document.addEventListener('click', onClick)
    if (headings.length > 0) {
      track()
      // Captured on the document, so it hears the sheet scroll on a desktop and the page on a phone.
      document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    }
    return () => {
      document.removeEventListener('click', onClick)
      document.removeEventListener('scroll', onScroll, { capture: true })
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])
  return null
}
