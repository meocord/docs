import { readFileSync } from 'node:fs'
import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { CliCommand, CliManifest } from '../../../scripts/lib/cli'
import { cliArticle, renderCliPage } from '@/lib/docs/api-render'
import { cliParams } from '@/lib/docs/api-site'
import { cliCommand, exampleInvocation, subcommandAnchor, usageOf } from '@/lib/docs/cli-site'

const manifest = JSON.parse(readFileSync('generated/cli/4.1.0-beta.7.json', 'utf8')) as CliManifest
const command = (name: string) => cliCommand(manifest, name)!
const html = (nodes: ReturnType<typeof cliArticle>['nodes']) => renderToStaticMarkup(Div({ children: nodes }).render())

describe('the CLI reference', () => {
  it("writes each command's usage, and an example from the manifest alone, with sample values", () => {
    expect(usageOf(command('build'))).toBe('meocord build [options]')
    expect(exampleInvocation(command('build'), 'meocord@beta')).toBe('npx meocord build --dev')
    // `create` runs outside a project, so it runs the package that installs the page's version
    expect(exampleInvocation(command('create'), 'meocord@beta')).toBe('npx meocord@beta create my-bot')
    expect(exampleInvocation(command('create'), 'meocord@4.1.0-beta.7')).toBe('npx meocord@4.1.0-beta.7 create my-bot')
    expect(exampleInvocation(command('register'), 'meocord@beta')).toBe('npx meocord register --build')
    // A command that only groups others shows its first subcommand's, a required argument by its first choice
    expect(exampleInvocation(command('generate'), 'meocord@beta')).toBe(
      'npx meocord generate controller button Greeting',
    )
    const unknown = { ...command('create'), arguments: [{ ...command('create').arguments[0]!, name: 'region' }] }
    expect(() => exampleInvocation(unknown, 'meocord@beta')).toThrow(
      "meocord create's example has no sample value for <region>",
    )
    expect(usageOf(command('generate').commands[0])).toBe('meocord generate controller [options] <type> <name>')
  })

  it("draws a command's page with its example, and each subcommand at its anchor", () => {
    // The example a reader copies carries its command for commands:check; the usage beside it doesn't
    const create = html(cliArticle(command('create'), 'meocord@beta').nodes)
    expect(create).toContain('data-example="npx meocord@beta create my-bot"')
    expect(create.match(/data-example=/g)).toHaveLength(1)
    const { nodes, toc } = cliArticle(command('generate'), 'meocord@beta')
    const markup = html(nodes)
    // The example as a reader copies it: the highlighted runs' text
    const text = markup
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;|&#x3C;/g, '<')
      .replace(/&gt;/g, '>')
    expect(text).toContain('npx meocord generate controller button Greeting')
    expect(markup).toContain('<h2 id="controller">meocord generate controller</h2>')
    expect(toc.map(entry => entry.id)).toEqual(command('generate').commands.map(subcommandAnchor))
  })

  describe('where the API is arranged by kind', () => {
    beforeAll(() => vi.stubEnv('DOCS_NEXT', '1'))
    afterAll(() => vi.unstubAllEnvs())

    it('has a page for every command in the manifest and none for a command it lacks, every subcommand anchored', () => {
      const pages = cliParams()
        .filter(param => param.line === '4.1' && !param.version)
        .map(param => param.command)
      expect(pages).toEqual(manifest.commands.map(each => each.name))
      const everySub = (each: CliCommand): string[] => each.commands.flatMap(sub => [sub.name, ...everySub(sub)])
      for (const each of manifest.commands) {
        const ids = cliArticle(each, 'meocord@beta').toc.map(entry => entry.id)
        expect(ids).toEqual(everySub(each).map(name => name.toLowerCase()))
      }
      expect(renderCliPage('4.1', 'deploy')).toBeUndefined()
      // Only versions that ship the manifest have CLI pages of their own
      const versions = new Set(cliParams().flatMap(param => (param.version ? [param.version] : [])))
      expect([...versions]).toEqual(['4.1.0-beta.7'])
    })
  })
})
