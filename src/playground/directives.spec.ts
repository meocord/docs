import { beforeAll, describe, expect, it } from 'vitest'
import { withoutCode } from '../../scripts/lib/content'
import { guideFolder, guidePath, readGuide } from '../../scripts/lib/guide'
import { resolveExample } from '../../scripts/lib/pages'
import { readVersions } from '../../scripts/lib/versions'
import { paths } from '../../scripts/lib/layout'
import { existsSync } from 'node:fs'
import { compile, pinnedModules } from '../../tests/playground'
import { parseDispatchList } from './dispatch-list'
import type { LogLine } from './runtime/protocol'
import { type ModuleMap, runPlayground } from './runtime/run'

// Every ::playground the Guide embeds, read from its pages, so a new one is run the day it lands
const DIRECTIVES = readVersions(paths.versions)
  .lines.filter(({ line, guides }) => guides === 'authored' && existsSync(guideFolder(line)))
  .flatMap(({ line }) =>
    readGuide(line).flatMap(({ page, body }) =>
      [...withoutCode(body).matchAll(/^::playground\{([^}]*)\}\s*$/gm)].map(match => {
        const attributes = Object.fromEntries([...match[1].matchAll(/(\w+)="([^"]*)"/g)].map(([, k, v]) => [k, v]))
        return { line, page: page.id, file: attributes.file, dispatch: attributes.dispatch, pagePath: guidePath(page) }
      }),
    ),
  )

const modules = new Map<string, ModuleMap>()
beforeAll(async () => {
  for (const line of new Set(DIRECTIVES.map(each => each.line))) modules.set(line, await pinnedModules(line))
})

describe("the Guide's playgrounds", () => {
  it('embeds at least one', () => {
    expect(DIRECTIVES.length).toBeGreaterThan(0)
  })

  it.each(DIRECTIVES)(
    '$line/$page runs $file with "$dispatch" at the pinned meocord, every input answered',
    async ({ line, file, dispatch, pagePath }) => {
      const list = parseDispatchList(dispatch)
      if (typeof list === 'string') throw new Error(list)
      const logs: LogLine[] = []
      const result = await runPlayground(
        {
          type: 'run',
          id: 1,
          source: resolveExample(line, file, undefined, { page: pagePath }),
          dispatch: list.steps,
          ...(list.caller && { caller: list.caller }),
        },
        { modules: modules.get(line)!, compile, logs },
      )
      if (!result.ok) throw new Error(`${result.stage}: ${result.message}\n${logs.map(l => l.text).join('\n')}`)
      for (const step of result.steps) {
        expect(step.error, JSON.stringify(step.input)).toBeUndefined()
        expect(step.ran, JSON.stringify(step.input)).toBe(true)
      }
      expect(result.steps.flatMap(step => step.calls).length).toBeGreaterThan(0)
    },
  )
})
