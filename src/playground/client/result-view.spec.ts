// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { RunResult } from '../runtime/protocol'
import { showResult, showStatus } from './result-view'

// What the reader's code might put in any field of a result
const HOSTILE = `<img src=x onerror="window.pwned=1"><script>window.pwned=1</script><a href="javascript:window.pwned=1">x</a>`
const TAGS = new Set(['DIV', 'OL', 'UL', 'LI', 'P', 'CODE', 'STRONG', 'DETAILS', 'SUMMARY', 'PRE'])
const allowedAttribute = (name: string) => name.startsWith('data-') || name === 'tabindex' || name === 'open'

/** The document around `output`, which showing a result must leave as it was. */
function outside(output: HTMLElement): string {
  const shown = [...output.childNodes]
  output.replaceChildren()
  const html = document.documentElement.outerHTML
  output.replaceChildren(...shown)
  return html
}

/** Every element under `root` that a result view may not make, and every attribute it may not set. */
function unexpected(root: HTMLElement): string[] {
  return [...root.querySelectorAll('*')].flatMap(element => [
    ...(TAGS.has(element.tagName) ? [] : [`<${element.tagName.toLowerCase()}>`]),
    ...element
      .getAttributeNames()
      .filter(name => !allowedAttribute(name))
      .map(name => `${element.tagName}[${name}]`),
  ])
}

const everywhere: RunResult = {
  type: 'result',
  id: 1,
  ok: true,
  truncated: true,
  logs: [{ level: 'error', text: HOSTILE }],
  steps: [
    {
      input: { kind: 'slash', command: HOSTILE, options: { [HOSTILE]: HOSTILE } },
      ran: true,
      handlers: [HOSTILE],
      error: { name: HOSTILE, message: HOSTILE },
      calls: [
        {
          method: HOSTILE,
          payload: {
            content: HOSTILE,
            embeds: [{ title: HOSTILE, description: HOSTILE }],
            components: [{ components: [{ label: HOSTILE, custom_id: HOSTILE }] }],
            [HOSTILE]: HOSTILE,
          },
        },
        { method: 'reply', payload: HOSTILE },
        { method: 'reply', error: HOSTILE },
      ],
    },
    { input: { kind: 'button', customId: HOSTILE }, ran: false, handlers: [], calls: [] },
    { input: { kind: 'select', customId: HOSTILE, values: [HOSTILE] }, ran: true, handlers: [], calls: [] },
    { input: { kind: 'modal', customId: HOSTILE, fields: { [HOSTILE]: HOSTILE } }, ran: true, handlers: [], calls: [] },
    { input: { kind: 'message', content: HOSTILE }, ran: true, handlers: [], calls: [] },
  ],
}

describe('the result view', () => {
  it('shows what a result carries as text in every field, making only its own elements and attributes', () => {
    const output = document.createElement('div')
    document.body.append(output)
    const before = outside(output)
    showResult(output, everywhere)
    for (const details of output.querySelectorAll('details')) details.open = true
    // Nothing changes outside the output, and inside it only the view's own elements and attributes
    expect(outside(output)).toBe(before)
    expect(unexpected(output)).toEqual([])
    expect(output.querySelectorAll('img, script, a, iframe, object, embed, svg, style, link, form')).toHaveLength(0)
    // Every field shows the markup as written: once per field it was put in
    const shown = output.textContent!.split(HOSTILE).length - 1
    expect(shown).toBeGreaterThanOrEqual(20)
  })

  it('shows a failed run and a status the same way', () => {
    const output = document.createElement('div')
    document.body.append(output)
    const before = outside(output)
    for (const stage of ['request', 'compile', 'load', 'module', 'timeout', 'runtime'] as const) {
      showResult(output, {
        type: 'result',
        id: 2,
        ok: false,
        stage,
        message: HOSTILE,
        logs: [{ level: 'log', text: HOSTILE }],
      })
      expect(outside(output), stage).toBe(before)
      expect(unexpected(output), stage).toEqual([])
      expect(output.textContent).toContain(HOSTILE)
    }
    showStatus(output, HOSTILE, true)
    expect(outside(output)).toBe(before)
    expect(unexpected(output)).toEqual([])
    expect(output.textContent).toBe(HOSTILE)
  })
})
