import { describe, expect, it } from 'vitest'
import type { ApiSignature } from '@/lib/docs/api-model'
import { callShape, firstSentence, glanceSection } from '@/lib/docs/glance'
import { VERSIONS } from '@/config/versions'
import { lineSegment } from '@/lib/urls'

// Each line's path segment as versions.json gives it: `latest` for the current line
const docs41 = `/docs/${lineSegment('4.1', VERSIONS)}`

const signature = (params: ApiSignature['params']): ApiSignature => ({
  code: [],
  description: '',
  params,
  throws: [],
  examples: [],
})

describe('cheat sheets', () => {
  it('writes how a signature is called from its own parameters: rest and optional marked, rows and `this` left out', () => {
    const param = (name: string, extra: Partial<ApiSignature['params'][number]> = {}) => ({
      name,
      type: [],
      optional: false,
      description: '',
      ...extra,
    })
    const send = signature([
      param('payload'),
      param('options', { optional: true }),
      param('options.ephemeral', { optional: true, option: true }),
    ])
    expect(callShape('send', send)).toBe('send(payload, options?)')
    expect(callShape('UseGuard', signature([param('...entries')]))).toBe('UseGuard(...entries)')
    expect(callShape('bind', signature([param('this'), param('value', { defaultValue: '1', optional: true })]))).toBe(
      'bind(value?)',
    )
    expect(callShape('MessageUsageError', signature([param('usage'), param('{ quiet }', { optional: true })]))).toBe(
      'MessageUsageError(usage, { quiet }?)',
    )
    expect(callShape('delete', signature([]))).toBe('delete()')
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
      `${docs41}/api/glance/decorators`,
      `${docs41}/api/glance/respond`,
      `${docs41}/api/glance/testing`,
      `${docs41}/api/glance/cli`,
    ])
  })
})
