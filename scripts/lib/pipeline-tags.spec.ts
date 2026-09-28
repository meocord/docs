import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ApiDocument } from './api'
import { paths } from './layout'
import { pipelineStageProblems } from './pipeline-tags'

/** A version's generated API as its file holds it. */
const generated = (version: string) => JSON.parse(readFileSync(paths.api(version), 'utf8')) as ApiDocument

/** Every @pipeline tag in a document, to plant a stage in or to count. */
function pipelineTags(node: unknown): { content: { text: string }[] }[] {
  if (!node || typeof node !== 'object') return []
  if ((node as { tag?: string }).tag === '@pipeline') return [node as { content: { text: string }[] }]
  return Object.values(node).flatMap(pipelineTags)
}

describe('pipelineStageProblems', () => {
  it("accepts the figure's stage ids and the names released tags used before them, in beta.6 and beta.7", () => {
    for (const version of ['4.1.0-beta.6', '4.1.0-beta.7']) {
      const doc = generated(version)
      // The tags are there to check, so a document read by the wrong shape can't pass with none
      expect(pipelineTags(doc.project).length).toBeGreaterThan(10)
      expect(pipelineStageProblems(doc, version)).toEqual([])
    }
  })

  it('names the symbol and the stage of a tag no stage of the figure answers to, in a generated file', () => {
    const doc = generated('4.1.0-beta.7')
    const autocomplete = pipelineTags(doc.project).find(tag =>
      tag.content[0]?.text.startsWith('handler after the guards'),
    )!
    autocomplete.content[0]!.text = autocomplete.content[0]!.text.replace(/^handler/, 'handlr')
    expect(pipelineStageProblems(doc, '4.1.0-beta.7')).toEqual([
      'generated/api/4.1.0-beta.7.json: meocord/decorator.Autocomplete has @pipeline "handlr", which is no stage of the pipeline figure',
    ])
  })
})
