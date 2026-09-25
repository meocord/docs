import type { ThemedCSSObject } from '@meonode/ui'
import type { themeTokens } from '@/constants/themes/tokens'

type MaterialLevel = keyof typeof themeTokens.material
type Duration = keyof typeof themeTokens.motion.duration

/**
 * A frosted material with its opaque twin. The twin applies without backdrop-filter support, under
 * `prefers-reduced-transparency`, and when the reader asks for reduced effects (`data-effects` on
 * <html>), and swaps only colours, so nothing moves between them.
 */
export function materialCss(level: MaterialLevel): ThemedCSSObject {
  const solid = { backdropFilter: 'none', backgroundColor: `theme.material.${level}.solid` }
  return {
    backgroundColor: `theme.material.${level}.fill`,
    backdropFilter: `theme.material.${level}.blur`,
    '@supports not (backdrop-filter: blur(1px))': solid,
    '@media (prefers-reduced-transparency: reduce)': solid,
    // `html[…] &`, not `:root[…] &`: Emotion nests a selector that starts with a colon under the class.
    'html[data-effects="reduced"] &': solid,
  }
}

/** The focus ring: 2px of accent, 2px out, with a halo. It replaces the outline, never removes it. */
export const focusCss: ThemedCSSObject = {
  '&:focus-visible': {
    outline: 'theme.focus.width solid theme.accent.default',
    outlineOffset: 'theme.focus.offset',
    boxShadow: '0 0 0 5px theme.accent.halo',
  },
}

/** A transition of transform and opacity only; reduced motion keeps the fade and drops the movement. */
export function transitionCss(
  properties: readonly ('transform' | 'opacity')[] = ['opacity'],
  duration: Duration = 'state',
): ThemedCSSObject {
  return {
    transitionProperty: properties.join(', '),
    transitionDuration: `theme.motion.duration.${duration}`,
    transitionTimingFunction: 'theme.motion.ease.enter',
    '@media (prefers-reduced-motion: reduce)': {
      transitionProperty: 'opacity',
      transitionDuration: 'theme.motion.duration.state',
    },
  }
}
