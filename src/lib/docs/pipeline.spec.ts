import { readFileSync } from 'node:fs'
import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { GUIDE_FIGURES, GUIDE_PLAN } from '../../../scripts/lib/guide'
import { pageAnchors } from '../../../scripts/lib/content'
import { apiModel } from '@/lib/docs/api-site'
import { FIGURES } from '@/lib/docs/figures'
import { everyStage, HANDLER_KINDS, PIPELINE, pipelineFigure } from '@/lib/docs/pipeline'

const figure = () => renderToStaticMarkup(Div({ children: pipelineFigure(url => url) }).render())

describe('the pipeline figure', () => {
  beforeAll(() => vi.stubEnv('DOCS_NEXT', '1'))
  afterAll(() => vi.unstubAllEnvs())

  it("links each stage to a Guide page on the plan, at a heading it has, and to the line's API", () => {
    const planned = new Set(Object.values(GUIDE_PLAN).flat())
    const model = apiModel('4.1')!
    for (const stage of everyStage()) {
      const [page, anchor] = stage.guide.replace(/^guide:/, '').split('#')
      expect(planned.has(page!), `${stage.id} links ${stage.guide}`).toBe(true)
      if (anchor) {
        const body = readFileSync(`content/4.1-next/${page}.md`, 'utf8')
        expect(pageAnchors(body).has(anchor), `${stage.id} links ${stage.guide}`).toBe(true)
      }
      if (stage.api) {
        const [section, symbol] = stage.api.split('/')
        expect(model.symbol(section!, symbol!), `${stage.id} names ${stage.api}`).toBeDefined()
      }
    }
  })

  it('runs every stage for some kind of handler, and the handler for every kind', () => {
    const kinds = HANDLER_KINDS.map(kind => kind.id)
    for (const stage of everyStage()) expect(stage.kinds.length).toBeGreaterThan(0)
    expect(everyStage().find(stage => stage.id === 'handler')!.kinds).toEqual(kinds)
    // Autocomplete answers within three seconds, so it runs no interceptors, and message commands alone parse
    expect(everyStage().find(stage => stage.id === 'interceptors')!.kinds).not.toContain('autocomplete')
    expect(everyStage().find(stage => stage.id === 'parse')!.kinds).toEqual(['message'])
    // A message handler without a pattern takes guards, interceptors and cooldowns, and none of a pattern's stages
    const bare = everyStage()
      .filter(stage => stage.kinds.includes('message-listener'))
      .map(stage => stage.id)
    expect(bare).toEqual([
      'observers-start',
      'filters',
      'guards',
      'interceptors',
      'cooldowns',
      'handler',
      'fallback',
      'observers-settled',
    ])
  })

  it("gives the fallback's words for every kind of handler, once each", () => {
    const fallback = everyStage().find(stage => stage.id === 'fallback')!
    const covered = fallback.byKind!.flatMap(entry => entry.kinds)
    expect([...covered].sort()).toEqual(HANDLER_KINDS.map(kind => kind.id).sort())
    expect(new Set(covered).size).toBe(covered.length)
  })

  it('draws each stage in order, the ones a stage wraps inside it, with a choice of handler', () => {
    const markup = figure()
    expect(markup.match(/<input type="radio" name="pipeline-kind"/g)).toHaveLength(HANDLER_KINDS.length + 1)
    expect(markup).toContain('<input type="radio" name="pipeline-kind" checked="" value="all"/>')
    expect(markup.match(/<li data-kinds=/g)).toHaveLength(everyStage().length)
    const names = [...markup.matchAll(/<div data-stage="true"><a href="[^"]*">([^<]+)<\/a>/g)].map(match => match[1])
    expect(names).toEqual(everyStage().map(stage => stage.name.replace(/'/g, '&#x27;')))
    // Interceptors wrap validation, pipes, cooldowns, the lock and the handler
    const interceptors = markup.slice(markup.indexOf('Interceptors'))
    expect(interceptors.indexOf('Validation')).toBeLessThan(interceptors.indexOf('The handler'))
    expect(markup).toContain('<a href="api:decorators/UseGuard" data-api="true"><code>@UseGuard</code></a>')
    expect(PIPELINE.at(0)!.id).toBe('observers-start')
    expect(PIPELINE.at(-1)!.id).toBe('observers-settled')
  })

  it('is the one figure a Guide page can name, and content:check knows it', () => {
    expect(Object.keys(FIGURES)).toEqual([...GUIDE_FIGURES])
  })
})
