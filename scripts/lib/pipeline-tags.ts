import { stagesNamed } from '../../src/lib/docs/pipeline.js'
import type { ApiDocument } from './api.js'

interface Node {
  name?: string
  tag?: string
  content?: { text: string }[]
  [key: string]: unknown
}

/**
 * Every `@pipeline` tag in a version's generated API, `generated/api/<version>.json` as written, whose
 * stage isn't one of the pipeline figure's, wherever the tag sits, named by the symbols that lead to it.
 */
export function pipelineStageProblems(doc: ApiDocument, version: string): string[] {
  const problems: string[] = []
  const visit = (node: unknown, names: string[]) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, names)
      return
    }
    const { name, tag, content } = node as Node
    if (tag === '@pipeline') {
      const stage =
        (content ?? [])
          .map(part => part.text)
          .join('')
          .trim()
          .split(/\s+/)[0] ?? ''
      if (stagesNamed(stage).length === 0)
        problems.push(
          `generated/api/${version}.json: ${names.join('.')} has @pipeline "${stage}", which is no stage of the pipeline figure`,
        )
      return
    }
    // A signature repeats its symbol's name, so each name counts once
    const inside = typeof name === 'string' && name !== names.at(-1) ? [...names, name] : names
    for (const value of Object.values(node)) visit(value, inside)
  }
  visit(doc.project.children, [])
  return problems
}
