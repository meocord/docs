import type { ThemedCSSObject } from '@meonode/ui'

/**
 * The ears' flick: the far ear tips outward and springs back, and the near ear answers a beat later,
 * smaller and the other way. The same motion as the animated avatar in the meocord repository's
 * brand tools, so the mark twitches the same way wherever it is drawn.
 */

/**
 * The flick, as numbers: each ear is a damped spring, `amplitude · e^(−t/decay) · sin(2πt/period)`
 * degrees clockwise from `delay` seconds in, sampled every `stepMs` and rounded to 0.1°, turning about
 * `pivot` in mark units (the valley between the ears). They match the avatar's in the meocord
 * repository's brand tools.
 */
export const EAR_FLICK = {
  pivot: [9.6, 8.4],
  seconds: 0.6,
  stepMs: 30,
  far: { amplitude: 17.5, decay: 0.1, period: 0.3, delay: 0 },
  near: { amplitude: -7, decay: 0.1, period: 0.3, delay: 0.08 },
} as const

/** The point both ears turn about, in mark units. */
export const EAR_PIVOT = EAR_FLICK.pivot

/** How long one flick lasts, in seconds; it has settled by then. */
export const FLICK_SECONDS = EAR_FLICK.seconds

/** Degrees clockwise at `t` seconds into a flick, for the far ear and the near one. */
export function flickAngles(t: number): { far: number; near: number } {
  const angle = ({ amplitude, decay, period, delay }: (typeof EAR_FLICK)['far' | 'near']) => {
    const late = t - delay
    const degrees = late > 0 ? amplitude * Math.exp(-late / decay) * Math.sin((2 * Math.PI * late) / period) : 0
    return Math.round(degrees * 10) / 10 || 0
  }
  return { far: angle(EAR_FLICK.far), near: angle(EAR_FLICK.near) }
}

/** The flick's samples, every EAR_FLICK.stepMs, as keyframe steps placed within a cycle of `period` seconds. */
function steps(ear: 'far' | 'near', period: number, property: 'rotate' | 'transform') {
  const frames: Record<string, Record<string, string>> = {}
  const value = (degrees: number) => (property === 'rotate' ? `${degrees}deg` : `rotate(${degrees}deg)`)
  for (let ms = 0; ms <= FLICK_SECONDS * 1000; ms += EAR_FLICK.stepMs) {
    frames[`${+((ms / 1000 / period) * 100).toFixed(3)}%`] = { [property]: value(flickAngles(ms / 1000)[ear]) }
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
