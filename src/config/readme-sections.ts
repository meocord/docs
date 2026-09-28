import type { AnchorTarget } from '../../scripts/lib/changelog'

/**
 * Sections of meocord's README that its changelogs link, placed on a line's Guide pages where no page
 * id or heading of the same name holds them. The changelog rewrite reads these over the pages' own.
 */
export const README_SECTIONS: Record<string, Record<string, AnchorTarget>> = {
  '4.1': {
    'themes-per-server-and-per-user': { slug: 'theming', anchor: 'per-server-and-per-user' },
    'store-recipes': { slug: 'cooldown-stores', group: 'recipes' },
  },
}
