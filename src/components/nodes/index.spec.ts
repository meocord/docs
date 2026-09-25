import { Component, createChildrenFirstNode, createNode, Div } from '@meonode/ui'
import { describe, expect, it } from 'vitest'
import * as nodes from '@/components/nodes'
import { SidebarPane } from '@/components/shell/panes'

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

describe('@/components/nodes', () => {
  it('exports createNode factories over tags, and nothing else', () => {
    const exports = Object.entries(nodes)
    expect(exports.length).toBeGreaterThan(0)
    for (const [name, value] of exports) expect([name, isPropsFirstFactory(value)]).toEqual([name, true])
  })

  it('would refuse a children-first factory, a component, or a pane that merges its own css', () => {
    expect(isPropsFirstFactory(createNode('div', { padding: 1 }))).toBe(true)
    expect(isPropsFirstFactory(createChildrenFirstNode('p'))).toBe(false)
    expect(isPropsFirstFactory(Component(() => Div()))).toBe(false)
    expect(isPropsFirstFactory(SidebarPane)).toBe(false)
  })
})
