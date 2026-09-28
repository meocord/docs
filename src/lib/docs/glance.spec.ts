import { describe, expect, it } from 'vitest'
import type { ApiSignature } from '@/lib/docs/api-model'
import { callShape, firstSentence, glanceSection } from '@/lib/docs/glance'

const signature = (code: string): ApiSignature => ({
  code: [{ text: code }],
  description: '',
  params: [],
  throws: [],
  examples: [],
})

describe('cheat sheets', () => {
  it('writes how a signature is called, from its declaration: rest and optional parameters marked', () => {
    expect(callShape('send', signature('send(payload: P, options?: { ephemeral?: boolean }): Promise<void>'))).toBe(
      'send(payload, options?)',
    )
    expect(
      callShape(
        'UseGuard',
        signature('UseGuard<T extends readonly unknown[]>(...entries: { [K in keyof T]: E }): any'),
      ),
    ).toBe('UseGuard(...entries)')
    // A rest parameter, an arrow or a comma inside a type is not the list's own
    expect(
      callShape('On', signature('On<E extends keyof Events>(event: E, handler: (...event: A, b: B) => void): any')),
    ).toBe('On(event, handler)')
    expect(callShape('delete', signature('delete(): Promise<void>'))).toBe('delete()')
  })

  it("takes a summary's first sentence, keeping a name with a dot whole", () => {
    expect(firstSentence('Sends the answer. Before any answer it is the first reply.')).toBe('Sends the answer.')
    expect(firstSentence('Options for `ResponseState.error`, as a filter sets them.')).toBe(
      'Options for `ResponseState.error`, as a filter sets them.',
    )
    expect(firstSentence('One line\nwrapped. Then more.\n\nA second paragraph.')).toBe('One line wrapped.')
  })

  it('lists the cheat sheets as a section of the API', () => {
    expect(glanceSection('4.1').symbols.map(symbol => symbol.href)).toEqual([
      '/docs/4.1/api/glance/decorators',
      '/docs/4.1/api/glance/respond',
      '/docs/4.1/api/glance/testing',
      '/docs/4.1/api/glance/cli',
    ])
  })
})
