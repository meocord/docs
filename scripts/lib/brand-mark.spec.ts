import { describe, expect, it } from 'vitest'
import { CANONICAL_MARK_URL, checkMark, FETCH_ATTEMPTS, markVerdict } from './brand-mark.js'

const canonical = '{ "viewBox": [0, 0, 16, 16] }\n'
const serving =
  (status: number, body = canonical) =>
  async (url: string) => {
    expect(url).toBe(CANONICAL_MARK_URL)
    return new Response(body, { status })
  }

describe('checkMark and markVerdict', () => {
  it('passes a verbatim copy', async () => {
    const check = await checkMark(canonical, serving(200))
    expect(check).toEqual({ status: 'same' })
    expect(markVerdict(check, { onMain: true }).level).toBe('pass')
  })

  it('fails a copy that differs, or is missing, wherever it runs, saying to sync', async () => {
    for (const copy of [canonical.replace('16, 16', '16, 15'), canonical.trimEnd(), undefined]) {
      const verdict = markVerdict(await checkMark(copy, serving(200)), { onMain: false })
      expect(verdict.level).toBe('fail')
      expect(verdict.message).toContain('bun run brand:sync')
    }
  })

  it('fails when meocord main has no mark, a definite answer rather than a blip', async () => {
    const check = await checkMark(canonical, serving(404), async () => {})
    expect(check).toEqual({ status: 'missing' })
    expect(markVerdict(check, { onMain: false }).level).toBe('fail')
  })

  it('only warns on a pull request when meocord cannot be reached, and fails on main', async () => {
    const waits: number[] = []
    const check = await checkMark(canonical, serving(503), async ms => waits.push(ms))
    expect(check).toEqual({
      status: 'unreachable',
      reason: `3 attempts: ${Array(FETCH_ATTEMPTS).fill(`${CANONICAL_MARK_URL} answered 503`).join('; ')}`,
    })
    expect(waits).toEqual([1000, 2000])
    expect(markVerdict(check, { onMain: false }).level).toBe('warn')
    expect(markVerdict(check, { onMain: true }).level).toBe('fail')

    const offline = await checkMark(
      canonical,
      async () => Promise.reject(new Error('getaddrinfo ENOTFOUND')),
      async () => {},
    )
    expect(offline.status).toBe('unreachable')
    expect(markVerdict(offline, { onMain: true }).message).toContain('getaddrinfo ENOTFOUND')
  })

  it('retries a blip, and passes once meocord answers', async () => {
    let calls = 0
    const flaky = async () =>
      ++calls < 3 ? new Response('', { status: 502 }) : new Response(canonical, { status: 200 })
    expect(await checkMark(canonical, flaky, async () => {})).toEqual({ status: 'same' })
    expect(calls).toBe(3)
  })

  it('does not retry a 404, which is an answer', async () => {
    let calls = 0
    const gone = async () => (calls++, new Response('', { status: 404 }))
    expect(await checkMark(canonical, gone, async () => {})).toEqual({ status: 'missing' })
    expect(calls).toBe(1)
  })
})
