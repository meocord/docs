import { describe, expect, it } from 'vitest'
import { commandProblems, htmlText, lineOfUrl } from './built-commands'
import type { VersionsConfig } from './versions'

const config: VersionsConfig = {
  package: 'meocord',
  since: '4.0.0',
  provenance: { issuer: '', identities: [], integrityOnly: [] },
  lines: [
    { line: '4.1', status: 'prerelease', guides: 'authored', versions: ['4.1.0-beta.7'] },
    { line: '4.0', status: 'current', guides: 'readme', versions: ['4.0.0'] },
  ],
}
const check = (url: string, text: string) => commandProblems([{ file: 'page.html', url, text }], config, '4.1')

describe('the create commands a reader gets', () => {
  it('finds the line a page documents: by its URL, through the aliases, and the home page by its own', () => {
    expect(lineOfUrl('/docs/4.1/getting-started#install', config, '4.1')).toBe('4.1')
    expect(lineOfUrl('/docs/latest/testing', config, '4.1')).toBe('4.0')
    expect(lineOfUrl('/docs/next', config, '4.1')).toBe('4.1')
    expect(lineOfUrl('/', config, '4.1')).toBe('4.1')
    expect(lineOfUrl('/_not-found', config, '4.1')).toBeUndefined()
    expect(lineOfUrl('/docs/4.1/changelog/4.1.0-beta.7', config, '4.1')).toBeUndefined()
  })

  it('reads a highlighted command whole, as a reader copies it', () => {
    const html =
      '<pre><code><span style="--a:1">npx</span><span> meocord&#x40;beta</span> <span>create</span></code></pre>'
    expect(htmlText(html)).toBe('npx meocord@beta create')
  })

  it('refuses a command that installs another line, or no line in particular, or a placeholder left over', () => {
    expect(check('/docs/4.1/getting-started', 'Run `npx meocord@beta create my-bot`.')).toEqual([])
    expect(check('/docs/latest/getting-started', 'npx meocord create my-bot')).toEqual([])
    expect(check('/', 'npx meocord create my-bot')).toEqual([
      `page.html (/): "npx meocord create" doesn't install 4.1; its pages run meocord@beta`,
    ])
    expect(check('/docs/4.0/overview', 'bunx meocord@beta create x')).toEqual([
      `page.html (/docs/4.0/overview): "bunx meocord@beta create" doesn't install 4.0; its pages run meocord`,
    ])
    expect(check('/_not-found', 'meocord create')).toEqual([
      `page.html (/_not-found): "meocord create" is on a page of no line, so it installs no line in particular`,
    ])
    expect(check('/docs/4.1/overview', 'npx {{meocord}} create')).toEqual([
      'page.html (/docs/4.1/overview): {{meocord}} was left in the output',
    ])
  })

  it("leaves pages whose text names past releases' commands, or is the package's own", () => {
    for (const url of ['/docs/4.1/changelog', '/docs/4.1/migrating#cli', '/docs/4.1/api/cli/create'])
      expect(check(url, 'npx meocord create my-bot')).toEqual([])
  })
})
