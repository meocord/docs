import { readFileSync } from 'node:fs'
import { Div } from '@meonode/ui'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { GUIDE_FIGURES, GUIDE_PLAN } from '../../../scripts/lib/guide'
import { pageAnchors } from '../../../scripts/lib/content'
import { apiModel } from '@/lib/docs/api-site'
import { FIGURES } from '@/lib/docs/figures'
import { Prose } from '@/components/nodes'
import { everyStage, HANDLER_KINDS, LEGACY_STAGES, PIPELINE, pipelineFigure, stagesNamed } from '@/lib/docs/pipeline'

const figure = () => renderToStaticMarkup(Div({ children: pipelineFigure(url => url) }).render())

describe('the pipeline figure', () => {
  afterAll(() => vi.unstubAllEnvs())

  it("links each stage to a Guide page on the plan, at a heading it has, and to the line's API", () => {
    const planned = new Set(Object.values(GUIDE_PLAN).flat())
    const model = apiModel('4.1')!
    for (const stage of everyStage()) {
      const [page, anchor] = stage.guide.replace(/^guide:/, '').split('#')
      expect(planned.has(page!), `${stage.id} links ${stage.guide}`).toBe(true)
      if (anchor) {
        const body = readFileSync(`content/4.1/${page}.md`, 'utf8')
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
    expect(markup.match(/<li id="stage-[a-z-]+" data-kinds=/g)).toHaveLength(everyStage().length)
    const names = [...markup.matchAll(/<div data-stage="true"><a href="[^"]*">([^<]+)<\/a>/g)].map(match => match[1])
    expect(names).toEqual(everyStage().map(stage => stage.name.replace(/'/g, '&#x27;')))
    // Interceptors wrap validation, pipes, cooldowns, the lock and the handler
    const interceptors = markup.slice(markup.indexOf('Interceptors'))
    expect(interceptors.indexOf('Validation')).toBeLessThan(interceptors.indexOf('The handler'))
    expect(markup).toContain('<a href="api:decorators/UseGuard" data-api="true"><code>@UseGuard</code></a>')
    expect(PIPELINE.at(0)!.id).toBe('observers-start')
    expect(PIPELINE.at(-1)!.id).toBe('observers-settled')
  })

  it("is styled by an attribute of its own, which the home page's panel of the same name doesn't carry", () => {
    const markup = figure()
    expect(markup).toContain('<figure data-pipeline-figure="true">')
    expect(markup).not.toContain('data-pipeline=')
    // The reading column's rules for the figure, each scoped to its attribute and none to the home panel's
    const rules = Object.keys((Prose({ children: [] }) as unknown as { props: { css: object } }).props.css)
    const named = rules.filter(rule => rule.includes('data-pipeline'))
    expect(named.length).toBeGreaterThan(10)
    expect(named.filter(rule => !rule.startsWith('& [data-pipeline-figure]'))).toEqual([])
  })

  it("anchors each stage for an API page's link, apart from the page's own headings", () => {
    const markup = figure()
    const ids = everyStage().map(stage => `stage-${stage.id}`)
    for (const id of ids) expect(markup).toContain(`<li id="${id}"`)
    const page = readFileSync('content/4.1/how-a-call-runs.md', 'utf8')
    expect(ids.filter(id => pageAnchors(page).has(id))).toEqual([])
  })

  it('finds the stages a tag names, by its id or the name released tags used before it', () => {
    expect(stagesNamed('guards').map(stage => stage.id)).toEqual(['guards'])
    expect(stagesNamed('observers').map(stage => stage.id)).toEqual(['observers-start', 'observers-settled'])
    expect(stagesNamed('lock').map(stage => stage.id)).toEqual(['defer-lock'])
    expect(stagesNamed('prelude')).toEqual([])
    // An older name stands for stages the figure has, never for one of its own ids
    const known = new Set(everyStage().map(stage => stage.id))
    for (const [name, ids] of Object.entries(LEGACY_STAGES)) {
      expect(known.has(name)).toBe(false)
      expect(ids.every(id => known.has(id))).toBe(true)
    }
  })

  it('is the one figure a Guide page can name, and content:check knows it', () => {
    expect(Object.keys(FIGURES)).toEqual([...GUIDE_FIGURES])
  })
})
