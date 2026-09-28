import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { playgroundCount, playgroundProblems } from './built-playground'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})
const publicWith = (...files: string[]) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'built-playground-'))
  dirs.push(dir)
  mkdirSync(path.join(dir, 'playground'))
  for (const file of files) writeFileSync(path.join(dir, file), '')
  return dir
}
const FRAME = '/playground/4.1.0-beta.7.0123456789.html'
const embed = (frame: string) =>
  `<div data-playground-embed="true" data-playground-src="${frame}" data-playground-request="{&quot;source&quot;:&quot;a =&gt; b&quot;}"><figure data-code="true"></figure></div>`

describe('playgroundProblems', () => {
  it('passes a page whose playgrounds name frames the build wrote, and one with none', () => {
    const dir = publicWith(FRAME)
    expect(playgroundProblems('a.html', `<main>${embed(FRAME)}${embed(FRAME)}</main>`, dir)).toEqual([])
    expect(playgroundProblems('b.html', '<li data-frame="true"></li>', dir)).toEqual([])
    expect(playgroundCount(`${embed(FRAME)}${embed(FRAME)}`)).toBe(2)
  })

  it('refuses a playground rendered without its runtime, one with no frame, and a frame that is missing or not one', () => {
    const dir = publicWith()
    expect(
      playgroundProblems(
        'a.html',
        [
          '<div data-playground-embed="true" data-playground-unavailable="true"></div>',
          '<div data-playground-embed="true"></div>',
          embed(FRAME),
          embed('https://example.com/frame.html'),
        ].join(''),
        dir,
      ),
    ).toEqual([
      "a.html: 1 playground(s) rendered without the line's runtime; run playground:build before next build",
      'a.html: 1 playground(s) name no frame',
      `a.html: a playground names ${FRAME}, which the build did not write`,
      'a.html: a playground names "https://example.com/frame.html", which is not a playground frame',
    ])
  })
})
