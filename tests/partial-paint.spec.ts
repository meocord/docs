import { describe, expect, it } from 'vitest'
import { cutOffset } from '../e2e/partial-paint'

const html =
  '<main><div data-bar="true"><h2 id="t">Title</h2><div data-segments="true"><div><b>x</b></div></div>' +
  '<button data-step="true">Step</button><img src="a.png"></div></main>'
const at = (offset: number) => html.slice(0, offset)

describe('cutOffset', () => {
  it('cuts just after the opening tag of the first match', () => {
    expect(at(cutOffset(html, { selector: '[data-bar]', at: 'open' }))).toMatch(/<div data-bar="true">$/)
    expect(at(cutOffset(html, { selector: 'h2#t', at: 'open' }))).toMatch(/<h2 id="t">$/)
  })

  it('cuts after the whole element, past any nested element of the same tag', () => {
    expect(at(cutOffset(html, { selector: '[data-segments]', at: 'close' }))).toMatch(/<b>x<\/b><\/div><\/div>$/)
    expect(at(cutOffset(html, { selector: 'button[data-step="true"]', at: 'close' }))).toMatch(/Step<\/button>$/)
  })

  it('cuts after a void element at its tag, and refuses a selector nothing matches', () => {
    expect(at(cutOffset(html, { selector: 'img', at: 'close' }))).toMatch(/<img src="a.png">$/)
    expect(() => cutOffset(html, { selector: '[data-nope]', at: 'open' })).toThrow('No element matches')
  })
})
