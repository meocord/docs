import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PipelinePanel } from '@/components/home/PipelinePanel'
import { claims, features, pipelineDemo, specReport, whatsNew } from '@/lib/home/data'

// The example's `home` region, read here independently of the site's own example resolver.
function regionFromFile(): string {
  const file = path.join(process.cwd(), 'examples/4.1/src/home/pipeline.slash.controller.ts')
  const lines = readFileSync(file, 'utf8').split('\n')
  const start = lines.findIndex(line => line.trim() === '// #region home')
  const end = lines.findIndex(line => line.trim() === '// #endregion home')
  const body = lines.slice(start + 1, end)
  const indent = Math.min(...body.filter(line => line.trim()).map(line => /^\s*/.exec(line)![0].length))
  return body
    .map(line => line.slice(indent))
    .join('\n')
    .trim()
}

const decode = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')

describe('the pipeline panel', () => {
  const demo = pipelineDemo()
  const html = renderToStaticMarkup(PipelinePanel(demo).render())

  it('shows the example exactly as the file has it, whitespace and all', () => {
    const pane = /<div data-pane="code">[\s\S]*?<code>([\s\S]*?)<\/code>/.exec(html)![1]
    expect(decode(pane)).toBe(regionFromFile())
    expect(demo.source).toBe(regionFromFile())
  })

  it('ties each stage to the line that declares it', () => {
    const lines = demo.source.split('\n')
    const line = (id: string) => lines[demo.stages.find(stage => stage.id === id)!.line!]
    expect(line('defer')).toMatch(/^@Defer\(/)
    expect(line('guard')).toMatch(/^@UseGuard\(MemberGuard\)/)
    expect(line('interceptor:before')).toMatch(/^@UseInterceptor\(/)
    expect(line('pipe')).toMatch(/^@UsePipe\('name', TrimPipe\)/)
    expect(line('handler')).toMatch(/^async greet\(/)
    expect(line('respond')).toMatch(/respond\(interaction\)/)
  })

  it('reports what the recorded runs did', () => {
    const stage = (id: string) => demo.stages.find(entry => entry.id === id)!
    expect(stage('pipe').member).toBe('"  Ada  " → "Ada"')
    expect(stage('guard').blocked).toBe('denied')
    expect(stage('pipe').blocked).toBe('not reached')
    expect(demo.memberReply).toBe('Hello, Ada!')
    expect(demo.blockedReply).toBe('This command is for members.')
  })

  it('draws the finished member run first, for everyone', () => {
    expect(html).toContain('data-answered="true"')
    expect(html.match(/<li [^>]*data-state="done"/g)).toHaveLength(demo.stages.length)
  })
})

describe('the sections below', () => {
  it('back each claim with a region from the examples', () => {
    for (const claim of claims()) expect(claim.code.length, claim.title).toBeGreaterThan(40)
  })

  it('list what is new and the spec that runs', () => {
    expect(whatsNew().length).toBeGreaterThan(2)
    expect(specReport().lines[0]).toMatch(/^the stages of a call › /)
  })

  it('pair each feature with what its recorded call produced', () => {
    const [routing, cooldown, validation, presenter] = features()
    for (const feature of features()) expect(feature.code.length).toBeGreaterThan(0)
    expect(routing.code).toContain("'card/{ownerId}/refresh'")
    expect(routing.result).toEqual({
      kind: 'route',
      customId: 'card/111/refresh',
      handler: 'CardButtonController.refresh',
      params: { ownerId: '111' },
    })
    expect(cooldown.result).toMatchObject({ kind: 'private', text: expect.stringMatching(/try again in 3s/) })
    expect(validation.result).toMatchObject({ kind: 'private', text: expect.stringMatching(/^minutes:/) })
    expect(presenter.result).toMatchObject({ kind: 'embed', title: 'Something went wrong', private: true })
  })
})
