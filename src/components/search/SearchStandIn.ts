import { Fixed, Input, Row, Span } from '@meonode/ui'
import { safe } from '@/lib/design/css'
import { Glyph } from '@/components/shell/icons'
import { PopoverSurface } from '@/components/shell/panes'

/**
 * The palette's field before the palette is ready, drawn where the palette's own opens: a plain input
 * in the page's markup, shown while `<html>` carries `data-search-early` (`search-keys.ts`). It needs
 * no script to take keys, so what the reader types before the page hydrates, or while the palette
 * loads, is edited by the browser and handed to the palette when it opens.
 */
export function SearchStandIn() {
  return Fixed({
    inset: 0,
    zIndex: 'theme.z.palette',
    backgroundColor: 'theme.surface.scrim',
    css: { display: 'none', 'html[data-search-early] &': { display: 'block' } },
    children: PopoverSurface({
      'data-search-stand-in-panel': true,
      position: 'absolute',
      top: safe('12dvh', 'top'),
      left: '50%',
      width: 'min(640px, calc(100vw - 2 * theme.space.4))',
      padding: 0,
      overflow: 'hidden',
      css: { transform: 'translateX(-50%)' },
      children: Row({
        alignItems: 'center',
        gap: 'theme.space.2',
        padding: 'theme.space.3',
        css: { '@media (width < theme.breakpoint.compact)': { minHeight: 52 } },
        children: [
          Span(Glyph('search', 16), { key: 'icon', display: 'inline-flex', color: 'theme.ink.secondary' }),
          Input({
            key: 'input',
            type: 'search',
            'data-search-stand-in': true,
            'aria-label': 'Search the documentation',
            placeholder: 'Search',
            autoComplete: 'off',
            spellCheck: false,
            flexGrow: 1,
            minWidth: 0,
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'theme.ink.primary',
            fontFamily: 'inherit',
            fontSize: 'theme.type.body.size',
            css: {
              '&::-webkit-search-cancel-button': { display: 'none' },
              '@media (width < theme.breakpoint.compact)': { minHeight: 44 },
            },
          }),
        ],
      }),
    }),
  }).render()
}
