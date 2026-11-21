import { createNode } from '@meonode/ui'

/**
 * Prestyled factories the search field and the version switcher use. Listed in @meonode/compiler's
 * `factoryModules`, so it exports factories only; it stays out of @/components/nodes because those are client
 * components, and that module would bring its other factories into their bundles.
 */

/** The slot a glyph sits in beside a field's or a control's text: lined up with it, in the secondary ink. */
export const GlyphSlot = createNode('span', { display: 'inline-flex', color: 'theme.ink.secondary' })
