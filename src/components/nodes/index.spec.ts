import { readFileSync } from 'fs'
import { Component, createChildrenFirstNode, createNode, Div } from '@meonode/ui'
import { describe, expect, it } from 'vitest'
import * as nodes from '@/components/nodes'
import * as glyphSlot from '@/components/shell/glyph-slot'
import { SidebarPane } from '@/components/shell/panes'

/** Every module next.config.ts lists in `factoryModules`, by the specifier it lists. */
const FACTORY_MODULES: Record<string, Record<string, unknown>> = {
  '@/components/nodes': nodes,
  '@/components/shell/glyph-slot': glyphSlot,
}

/**
 * Whether a value is what @meonode/compiler's `factoryModules` takes every capitalized export of the
 * module to be: a createNode factory over a tag, whose first argument is its props. The compiler rewrites
 * that argument into marker props, which a children-first factory would render as a child and a
 * function that reads its own props would never see.
 */
function isPropsFirstFactory(value: unknown): boolean {
  if (typeof value !== 'function' || typeof (value as { element?: unknown }).element !== 'string') return false
  const node = (value as (props: object) => { rawProps?: Record<string, unknown> })({ 'data-probe': 1 })
  return node?.rawProps?.['data-probe'] === 1 && !('children' in (node.rawProps ?? {}))
}

describe('the factory modules', () => {
  it('are the modules next.config.ts lists in factoryModules', () => {
    const config = readFileSync(new URL('../../../next.config.ts', import.meta.url), 'utf8')
    const listed = [...(/factoryModules: \[([^\]]*)\]/.exec(config)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
      ([, name]) => name,
    )
    expect(listed).toEqual(Object.keys(FACTORY_MODULES))
  })

  it.each(Object.entries(FACTORY_MODULES))(
    '%s exports createNode factories over tags, and nothing else',
    (_, module) => {
      const exports = Object.entries(module)
      expect(exports.length).toBeGreaterThan(0)
      for (const [name, value] of exports) expect([name, isPropsFirstFactory(value)]).toEqual([name, true])
    },
  )

  it('would refuse a children-first factory, a component, or a pane that merges its own css', () => {
    expect(isPropsFirstFactory(createNode('div', { padding: 1 }))).toBe(true)
    expect(isPropsFirstFactory(createChildrenFirstNode('p'))).toBe(false)
    expect(isPropsFirstFactory(Component(() => Div()))).toBe(false)
    expect(isPropsFirstFactory(SidebarPane)).toBe(false)
  })
})
