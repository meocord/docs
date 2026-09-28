import { describe, expect, it } from 'vitest'
import { commandProblems, htmlText, lineOfUrl, pageCode, pageText, searchText } from './built-commands'
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
const commands = new Set(['create', 'build', 'start', 'generate', 'g', '--version', '-V'])
const check = (url: string, text: string, code?: string[]) =>
  commandProblems([{ file: 'page.html', url, text, code }], config, '4.1', commands)

describe('the create commands a reader gets', () => {
  it('finds the line a page documents: by its URL, through the aliases, and the home page by its own', () => {
    expect(lineOfUrl('/docs/4.1/getting-started#install', config, '4.1')).toBe('4.1')
    expect(lineOfUrl('/docs/latest/testing', config, '4.1')).toBe('4.0')
    expect(lineOfUrl('/docs/next', config, '4.1')).toBe('4.1')
    expect(lineOfUrl('/', config, '4.1')).toBe('4.1')
    expect(lineOfUrl('/_not-found', config, '4.1')).toBeUndefined()
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
      `page.html (/): "npx meocord create" doesn't install 4.1; this page runs meocord@beta`,
    ])
    expect(check('/docs/4.0/overview', 'bunx meocord@beta create x')).toEqual([
      `page.html (/docs/4.0/overview): "bunx meocord@beta create" doesn't install 4.0; this page runs meocord`,
    ])
    expect(check('/_not-found', 'meocord create')).toEqual([
      `page.html (/_not-found): "meocord create" is on a page of no line, so it installs no line in particular`,
    ])
    expect(check('/docs/4.1/overview', 'npx {{meocord}} create')).toEqual([
      'page.html (/docs/4.1/overview): {{meocord}} was left in the output',
    ])
  })

  it('refuses a copyable meocord command a shell has nothing on its path to run', () => {
    const html =
      '<p>`meocord build` writes dist/.</p>' +
      '<pre tabindex="0" data-language="bash"><code>npx meocord build --prod\nmeocord start --prod</code></pre>' +
      '<pre data-language="shell"><code>$ meocord g co slash Greeting\nnpm run build\n# meocord start</code></pre>' +
      // A transcript, or output, is text: shown, not run
      '<pre data-language="text"><code>$ meocord start --prod\nenv: node: No such file</code></pre><pre><code>meocord start</code></pre>'
    const code = pageCode('/docs/4.1/cli', html)
    expect(code).toContain('meocord start --prod')
    expect(check('/docs/4.1/cli', '', code)).toEqual([
      `page.html (/docs/4.1/cli): "meocord start --prod" doesn't run in a shell, which has no meocord on its path; write npx meocord, or run it from a package script`,
      `page.html (/docs/4.1/cli): "$ meocord g co slash Greeting" doesn't run in a shell, which has no meocord on its path; write npx meocord, or run it from a package script`,
    ])
    // On an API page, what a reader copies is its examples
    const api = '<pre>meocord build [options]</pre><div data-example="meocord build --dev"></div>'
    expect(pageCode('/docs/4.1/api/cli/build', api)).toEqual(['meocord build --dev'])
  })

  it("leaves changelogs and migration guides, which name past releases' commands", () => {
    for (const url of ['/docs/4.1/changelog', '/docs/4.1/changelog/4.1.0-beta.7', '/docs/4.1/migrating#cli'])
      expect(check(url, 'npx meocord create my-bot')).toEqual([])
  })

  it("reads only an API page's copyable examples, each against its page's version", () => {
    const html =
      '<h1>meocord create</h1><pre>meocord create [options] &lt;app-name&gt;</pre>' +
      '<div data-example="npx meocord@beta create my-bot"><pre>npx meocord@beta create my-bot</pre></div>'
    expect(pageText('/docs/4.1/api/cli/create', html)).toBe('npx meocord@beta create my-bot')
    expect(pageText('/docs/4.1/overview', '<p>`meocord create`</p>')).toBe('`meocord create`')
    expect(check('/docs/4.1/api/cli/create', 'npx meocord@beta create my-bot')).toEqual([])
    expect(check('/docs/4.1/api/4.1.0-beta.7/cli/create', 'npx meocord@4.1.0-beta.7 create my-bot')).toEqual([])
    expect(check('/docs/4.1/api/4.1.0-beta.7/cli/create', 'npx meocord@beta create my-bot')).toEqual([
      `page.html (/docs/4.1/api/4.1.0-beta.7/cli/create): "npx meocord@beta create" doesn't install 4.1.0-beta.7; this page runs meocord@4.1.0-beta.7`,
    ])
    // The search index and the palette hold an API page's own text, which a reader doesn't run
    expect(searchText('/docs/4.1/api/cli/create', 'meocord create')).toBe('')
    expect(searchText('/docs/4.1/overview', 'the `create` command')).toBe('the `create` command')
  })
})
