'use client'

import { useEffect } from 'react'

/**
 * Makes the pipeline panel play. It draws nothing and ships almost nothing: the player itself is
 * loaded when the panel comes within a screen of the viewport, or at once if the reader reaches for
 * one of its controls first.
 */
export function PipelineIsland() {
  useEffect(() => {
    const panel = document.querySelector<HTMLElement>('[data-pipeline]')
    if (!panel) return
    let started = false
    const start = (autoplay: boolean) => {
      if (started) return
      started = true
      observer.disconnect()
      panel.removeEventListener('pointerdown', onReach, true)
      panel.removeEventListener('focusin', onReach, true)
      void import('@/components/home/pipeline-player').then(({ attach }) => attach(panel, { autoplay }))
    }
    const onReach = () => start(false)
    const observer = new IntersectionObserver(entries => entries.some(entry => entry.isIntersecting) && start(true), {
      rootMargin: '100% 0px',
    })
    observer.observe(panel)
    panel.addEventListener('pointerdown', onReach, true)
    panel.addEventListener('focusin', onReach, true)
    return () => {
      observer.disconnect()
      panel.removeEventListener('pointerdown', onReach, true)
      panel.removeEventListener('focusin', onReach, true)
    }
  }, [])
  return null
}
