import type { ThemedCSSObject } from '@meonode/ui'
import mark from './mark.json'

/**
 * The ears' flick: the far ear tips outward and springs back, and the near ear answers a beat later,
 * smaller and the other way. The same motion as the animated avatar in the meocord repository's
 * brand tools, so the mark twitches the same way wherever it is drawn.
 */

/**
 * The flick, as mark.json holds it: the point both ears turn about, in mark units (the valley between
 * them), and the frames every copy plays, `[ms, far, near]` in degrees clockwise, sampled from the
 * springs the meocord repository's brand tools define. The animated avatar plays the same frames.
 */
export const EAR_FLICK = mark.flick

/** The point both ears turn about, in mark units. */
export const EAR_PIVOT = mark.flick.pivot as [number, number]

/** How long one flick lasts, in seconds; its last frames are still. */
export const FLICK_SECONDS = mark.flick.durationMs / 1000

/** The frames of one flick, `[ms, far, near]`. */
export const FLICK_KEYFRAMES = mark.flick.keyframes as [number, number, number][]

/** Degrees clockwise at `t` seconds into a flick, for the far ear and the near one: the frame at or before it. */
export function flickAngles(t: number): { far: number; near: number } {
  const ms = t * 1000
  const frame = [...FLICK_KEYFRAMES].reverse().find(([at]) => at <= ms + 1e-6) ?? FLICK_KEYFRAMES[0]
  return { far: frame[1], near: frame[2] }
}

/** The flick's frames as keyframe steps placed within a cycle of `period` seconds, back to 0 at its end. */
function steps(ear: 'far' | 'near', period: number, property: 'rotate' | 'transform') {
  const frames: Record<string, Record<string, string>> = {}
  const value = (degrees: number) => (property === 'rotate' ? `${degrees}deg` : `rotate(${degrees}deg)`)
  for (const [ms, far, near] of FLICK_KEYFRAMES) {
    frames[`${+((ms / 1000 / period) * 100).toFixed(3)}%`] = { [property]: value(ear === 'far' ? far : near) }
  }
  frames['100%'] = { [property]: value(0) }
  return frames
}

/** How often the ears flick on their own, after the flick that greets the page. */
export const FLICK_PERIOD = 14

/**
 * The flick as CSS for a mark whose ear groups carry `data-ear="far"` and `data-ear="near"`: once as
 * the page opens, then every FLICK_PERIOD seconds, and again whenever one of `triggers` (such as the brand
 * link's hover and focus) matches. The cycle turns `rotate` and the triggered flick `transform`, so
 * the two compose and neither restarts the other. Still for readers who ask for less motion.
 */
export function earFlickCss(triggers: string[] = []): ThemedCSSObject {
  const ear = (side: 'far' | 'near') => `& [data-ear="${side}"]`
  const css: ThemedCSSObject = {
    '& [data-ear]': { transformBox: 'view-box', transformOrigin: `${EAR_PIVOT[0]}px ${EAR_PIVOT[1]}px` },
    [ear('far')]: { animation: `ear-far ${FLICK_PERIOD}s linear 0.6s infinite` },
    [ear('near')]: { animation: `ear-near ${FLICK_PERIOD}s linear 0.6s infinite` },
    '@keyframes ear-far': steps('far', FLICK_PERIOD, 'rotate'),
    '@keyframes ear-near': steps('near', FLICK_PERIOD, 'rotate'),
    '@keyframes ear-far-once': steps('far', FLICK_SECONDS, 'transform'),
    '@keyframes ear-near-once': steps('near', FLICK_SECONDS, 'transform'),
  }
  for (const side of ['far', 'near'] as const) {
    if (triggers.length === 0) break
    css[triggers.map(trigger => `${trigger} [data-ear="${side}"]`).join(', ')] = {
      animation: `ear-${side} ${FLICK_PERIOD}s linear 0.6s infinite, ear-${side}-once ${FLICK_SECONDS}s linear`,
    }
  }
  // Last, and over every trigger's rule.
  css['@media (prefers-reduced-motion: reduce)'] = { '& [data-ear]': { animation: 'none !important' } }
  return css
}
