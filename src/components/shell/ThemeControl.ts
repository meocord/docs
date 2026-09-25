'use client'

import { Button, Component, Div, For, useTheme } from '@meonode/ui'
import { focusCss, transitionCss } from '@/lib/design/css'
import { Glyph, type GlyphName } from '@/components/shell/icons'

const CHOICES: { value: 'system' | 'light' | 'dark'; label: string; glyph: GlyphName }[] = [
  { value: 'system', label: 'Match the system', glyph: 'monitor' },
  { value: 'light', label: 'Light', glyph: 'sun' },
  { value: 'dark', label: 'Dark', glyph: 'moon' },
]

/**
 * System, light or dark. The chosen segment is drawn from `data-theme-preference` on <html>, which the
 * pre-paint script stamps, so it is right in the first frame; `aria-pressed` follows once hydrated.
 */
export const ThemeControl = Component<{ touch?: boolean }>(function ThemeControl({ touch }) {
  const { preference, setPreference, hydrated } = useTheme()

  return Div({
    role: 'group',
    'aria-label': 'Colour theme',
    display: 'inline-flex',
    padding: 2,
    gap: 2,
    borderRadius: 'theme.radius.control',
    backgroundColor: 'theme.surface.fill',
    children: For(
      CHOICES,
      choice =>
        Button(Glyph(choice.glyph), {
          type: 'button',
          title: choice.label,
          'aria-label': choice.label,
          'aria-pressed': hydrated ? preference === choice.value : undefined,
          'data-value': choice.value,
          onClick: () => setPreference(choice.value),
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          // In the navigation sheet on a phone, each segment is a full touch target.
          width: touch ? 44 : 26,
          height: touch ? 44 : 24,
          padding: 0,
          border: 'none',
          borderRadius: 'theme.radius.chip',
          backgroundColor: 'transparent',
          color: 'theme.ink.secondary',
          cursor: 'pointer',
          css: {
            ...transitionCss(),
            ...focusCss,
            '&:hover': { color: 'theme.ink.primary' },
            [`html[data-theme-preference="${choice.value}"] &`]: {
              color: 'theme.ink.primary',
              backgroundColor: 'theme.surface.sheet',
              boxShadow: 'theme.elevation.1',
            },
          },
        }),
      choice => choice.value,
    ),
  })
})
