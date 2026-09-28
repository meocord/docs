import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { callShape } from '@/lib/docs/glance'

// The package the 4.1 examples pin, whose own declarations TypeScript reads here, apart from TypeDoc
const pkgDir = realpathSync('examples/4.1/node_modules/meocord')
const version = (JSON.parse(readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as { version: string }).version

const declarationFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory()
      ? declarationFiles(path.join(dir, entry.name))
      : entry.name.endsWith('.d.ts')
        ? [path.join(dir, entry.name)]
        : [],
  )

/** One declared parameter: its name, or none where it destructures, as TypeDoc names that from its `@param`. */
interface Declared {
  name?: string
  rest: boolean
  optional: boolean
}

/** Each function's and method's parameter lists, by `name` or `Owner.method`, as TypeScript parses them. */
function declaredParams(): Map<string, Declared[][]> {
  const lists = new Map<string, Declared[][]>()
  const add = (key: string, params: ts.NodeArray<ts.ParameterDeclaration>) => {
    const list = params
      .filter(param => !(ts.isIdentifier(param.name) && param.name.text === 'this'))
      .map(param => ({
        name: ts.isIdentifier(param.name) ? param.name.text : undefined,
        rest: !!param.dotDotDotToken,
        optional: !!(param.questionToken || param.initializer),
      }))
    lists.set(key, [...(lists.get(key) ?? []), list])
  }
  for (const file of declarationFiles(path.join(pkgDir, 'dist', 'types'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node.parameters)
      if ((ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
        const owner = node.name.text
        for (const member of node.members)
          if (
            (ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) &&
            member.name &&
            ts.isIdentifier(member.name)
          )
            add(`${owner}.${member.name.text}`, member.parameters)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return lists
}

/** Whether a call shape lists what one declaration does: the same parameters, in order, rest and optional alike. */
function matches(shape: string, lists: Declared[][]): boolean {
  const inner = shape.slice(shape.indexOf('(') + 1, -1)
  const params = inner ? inner.split(', ') : []
  return lists.some(
    list =>
      list.length === params.length &&
      list.every((declared, index) => {
        const param = params[index]!
        const rest = param.startsWith('...')
        const optional = param.endsWith('?')
        const name = param.replace(/^\.\.\./, '').replace(/\?$/, '')
        return rest === declared.rest && optional === declared.optional && (!declared.name || name === declared.name)
      }),
  )
}

describe('call shapes', () => {
  afterAll(() => vi.unstubAllEnvs())

  it("match what TypeScript parses from the pinned version's declarations, for every function and method", async () => {
    const { apiModel, apiSections } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const declared = declaredParams()
    let compared = 0
    for (const section of apiSections(model))
      for (const listing of section.symbols) {
        const symbol = model.symbol(section.slug, listing.name)
        if (!symbol) continue
        const own = declared.get(symbol.name)
        if (own && symbol.signatures.length > 0) {
          for (const signature of symbol.signatures) {
            const shape = callShape(symbol.name, signature)
            expect(matches(shape, own), `${shape} against ${JSON.stringify(own)}`).toBe(true)
          }
          compared += symbol.signatures.length
        }
        for (const member of symbol.members) {
          const theirs = declared.get(`${symbol.name}.${member.name}`)
          if (!theirs) continue
          for (const signature of member.signatures) {
            const shape = callShape(member.name, signature)
            expect(matches(shape, theirs), `${symbol.name}.${shape} against ${JSON.stringify(theirs)}`).toBe(true)
          }
          compared += member.signatures.length
        }
      }
    // Every cheat sheet's functions and methods among them, so a check of nothing can't pass
    expect(compared).toBeGreaterThan(100)
  })
})
