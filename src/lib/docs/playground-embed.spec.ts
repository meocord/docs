import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { playgroundEmbed } from '@/lib/docs/playground-embed'

const FRAME = '/playground/4.1.0-beta.7.0123456789.html'
const directive = {
  file: 'controllers/button/counter.button.controller.ts',
  region: 'typed',
  dispatch: 'as dm; button counter/41',
}
const html = (frameOf: (line: string) => string | undefined) =>
  renderToStaticMarkup(playgroundEmbed('4.1', directive, 0, { frameOf }).render())

describe('playgroundEmbed', () => {
  it('shows the region, a hidden Run button and the inputs, and carries the whole file and its inputs for the runner', () => {
    const out = html(() => FRAME)
    expect(out).toContain(`data-playground-src="${FRAME}"`)
    expect(out).toMatch(
      /<button type="button" hidden="" data-playground-run="true" aria-describedby="playground-inputs-0">Run<\/button>/,
    )
    expect(out).toContain('<span id="playground-inputs-0">Dispatches <code>as dm; button counter/41</code></span>')
    expect(out).toContain('aria-live="polite"')
    const request = JSON.parse(
      /data-playground-request="([^"]*)"/
        .exec(out)![1]
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    ) as { source: string; dispatch: unknown; caller: unknown }
    // The whole file runs, its imports included, with no region markers
    expect(request.source).toContain("import { respond, route } from 'meocord/common'")
    expect(request.source).not.toContain('#region')
    expect(request.dispatch).toEqual([{ kind: 'button', customId: 'counter/41' }])
    expect(request.caller).toEqual({ inGuild: false })
  })

  it("is the code frame alone, marked, without the line's runtime", () => {
    const out = html(() => undefined)
    expect(out).toContain('data-playground-unavailable="true"')
    expect(out).toContain('data-code="true"')
    expect(out).not.toContain('data-playground-run')
    expect(out).not.toContain('data-playground-request')
  })

  it('refuses a dispatch that does not parse', () => {
    expect(() => playgroundEmbed('4.1', { ...directive, dispatch: 'select' }, 0, { frameOf: () => FRAME })).toThrow(
      /dispatch step 1: select needs a customId/,
    )
  })
})
