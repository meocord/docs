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
    // Controls pressed while the player loads, replayed once it attaches so no press is lost.
    const pressed: HTMLElement[] = []
    const onPress = (event: Event) => {
      const control = (event.target as Element | null)?.closest<HTMLElement>('[data-choose], [data-run], [data-step]')
      if (control) pressed.push(control)
    }
    const start = (autoplay: boolean) => {
      if (started) return
      started = true
      observer.disconnect()
      panel.removeEventListener('pointerdown', onReach, true)
      panel.removeEventListener('focusin', onReach, true)
      void import('@/components/home/pipeline-player').then(({ attach }) => {
        panel.removeEventListener('click', onPress, true)
        attach(panel, { autoplay: autoplay && pressed.length === 0 })
        for (const control of pressed.splice(0)) control.click()
      })
    }
    const onReach = () => start(false)
    const observer = new IntersectionObserver(entries => entries.some(entry => entry.isIntersecting) && start(true), {
      rootMargin: '100% 0px',
    })
    observer.observe(panel)
    panel.addEventListener('pointerdown', onReach, true)
    panel.addEventListener('focusin', onReach, true)
    panel.addEventListener('click', onPress, true)
    return () => {
      observer.disconnect()
      panel.removeEventListener('click', onPress, true)
      panel.removeEventListener('pointerdown', onReach, true)
      panel.removeEventListener('focusin', onReach, true)
    }
  }, [])
  return null
}
