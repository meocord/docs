import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Div, ThemeProvider, type ThemedCSSObject } from '@meonode/ui'
import { themeModes } from '@/constants/themes/modes'
import { themeTokens } from '@/constants/themes/tokens'
import { focusCss, materialCss, transitionCss } from '@/lib/design/css'

function stylesOf(css: ThemedCSSObject): string {
  const html = renderToString(ThemeProvider({ ...themeModes, tokens: themeTokens, children: Div({ css }) }).render())
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(match => match[1]).join('\n')
}

describe('materialCss', () => {
  it('draws the frosted fill from the tokens', () => {
    const styles = stylesOf(materialCss('sidebar'))
    expect(styles).toContain('background-color:var(--meonode-theme-material-sidebar-fill)')
    expect(styles).toContain('backdrop-filter:var(--meonode-theme-material-sidebar-blur)')
  })

  it('falls back to the opaque twin without support, under reduced transparency and reduced effects', () => {
    const styles = stylesOf(materialCss('popover'))
    const solid = 'background-color:var\\(--meonode-theme-material-popover-solid\\)'
    expect(styles).toMatch(
      new RegExp(`@supports not \\(backdrop-filter: blur\\(1px\\)\\)\\{\\.css-[\\w-]+\\{[^}]*${solid}`),
    )
    expect(styles).toMatch(
      new RegExp(`@media \\(prefers-reduced-transparency: reduce\\)\\{\\.css-[\\w-]+\\{[^}]*${solid}`),
    )
    // Scoped to the document, not nested under the element's own class.
    expect(styles).toMatch(new RegExp(`(^|\\})html\\[data-effects="reduced"\\] \\.css-[\\w-]+\\{[^}]*${solid}`))
  })
})

describe('focusCss', () => {
  it('draws the ring on :focus-visible only', () => {
    const styles = stylesOf(focusCss)
    expect(styles).toMatch(
      /\.css-[\w-]+:focus-visible\{[^}]*outline:var\(--meonode-theme-focus-width[^;]*solid var\(--meonode-theme-accent-default/,
    )
  })
})

describe('transitionCss', () => {
  it('moves transform and opacity at the chosen duration', () => {
    expect(transitionCss(['transform', 'opacity'], 'open')).toMatchObject({
      transitionProperty: 'transform, opacity',
      transitionDuration: 'theme.motion.duration.open',
    })
  })

  it('keeps only the fade under reduced motion', () => {
    expect(transitionCss()['@media (prefers-reduced-motion: reduce)']).toEqual({
      transitionProperty: 'opacity',
      transitionDuration: 'theme.motion.duration.state',
    })
  })
})
