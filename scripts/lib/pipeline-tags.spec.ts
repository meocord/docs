import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { paths } from './layout'
import { pipelineStageProblems } from './pipeline-tags'

const tagged = (...tags: string[]) => ({
  children: [
    {
      name: 'meocord/decorator',
      children: [
        {
          name: 'Defer',
          signatures: [
            { name: 'Defer', comment: { blockTags: tags.map(text => ({ tag: '@pipeline', content: [{ text }] })) } },
          ],
        },
      ],
    },
  ],
})

describe('pipelineStageProblems', () => {
  it("accepts the figure's stage ids and the names released tags used before them", () => {
    expect(
      pipelineStageProblems(tagged('defer-lock just before the handler', 'lock after the cooldowns'), '9.0.0'),
    ).toEqual([])
    expect(pipelineStageProblems(tagged('observers around the whole call'), '9.0.0')).toEqual([])
  })

  it('names the symbol and the stage of a tag no stage of the figure answers to', () => {
    expect(pipelineStageProblems(tagged('prelude before everything'), '9.0.0')).toEqual([
      'generated/api/9.0.0.json: meocord/decorator.Defer has @pipeline "prelude", which is no stage of the pipeline figure',
    ])
  })

  it('finds every stage of the released tags in the figure', () => {
    for (const version of ['4.1.0-beta.6', '4.1.0-beta.7']) {
      const doc: unknown = JSON.parse(readFileSync(paths.api(version), 'utf8'))
      expect(pipelineStageProblems(doc, version)).toEqual([])
    }
  })
})
