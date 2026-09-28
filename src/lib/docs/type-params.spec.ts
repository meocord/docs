import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Token } from '@/lib/docs/api-model'

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

/** Code compared by its words and symbols: spacing, grouping parentheses and a last `;` in braces aside. */
const normal = (code: string) => code.replace(/\s+/g, '').replace(/[()]/g, '').replace(/;}/g, '}').replace(/"/g, "'")

/** Each generic function's and method's type parameter lists, by `name` or `Owner.method`, as written. */
function declaredTypeParams(): Map<string, string[][]> {
  const printer = ts.createPrinter({ removeComments: true })
  const lists = new Map<string, string[][]>()
  const add = (key: string, params: ts.NodeArray<ts.TypeParameterDeclaration> | undefined, source: ts.SourceFile) => {
    if (!params?.length) return
    const list = params.map(param => normal(printer.printNode(ts.EmitHint.Unspecified, param, source)))
    lists.set(key, [...(lists.get(key) ?? []), list])
  }
  for (const file of declarationFiles(path.join(pkgDir, 'dist', 'types'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node.typeParameters, source)
      if ((ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
        for (const member of node.members)
          if ((ts.isMethodSignature(member) || ts.isMethodDeclaration(member)) && ts.isIdentifier(member.name))
            add(`${node.name.text}.${member.name.text}`, member.typeParameters, source)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return lists
}

/** The type parameters a signature's code opens with after its name, split at their top-level commas. */
function renderedTypeParams(name: string, code: Token[]): string[] | undefined {
  const text = code.map(token => token.text).join('')
  const start = text.indexOf(`${name}<`)
  if (start < 0) return undefined
  const params: string[] = []
  let depth = 0
  let current = ''
  for (let index = start + name.length + 1; index < text.length; index += 1) {
    const char = text[index]
    if (char === '>' && text[index - 1] !== '=' && depth === 0) break
    if ('<({['.includes(char)) depth += 1
    if ((char === '>' && text[index - 1] !== '=') || ')}]'.includes(char)) depth -= 1
    if (char === ',' && depth === 0) {
      params.push(normal(current))
      current = ''
    } else current += char
  }
  return [...params, normal(current)]
}

describe('type parameters', () => {
  beforeAll(() => vi.stubEnv('DOCS_NEXT', '1'))
  afterAll(() => vi.unstubAllEnvs())

  it("read as the pinned version's declarations write them: modifiers, constraints and defaults", async () => {
    const { apiModel, apiSections } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const declared = declaredTypeParams()
    let compared = 0
    const check = (key: string, name: string, code: Token[]) => {
      const lists = declared.get(key)
      const rendered = renderedTypeParams(name, code)
      if (!lists || !rendered) return
      expect(lists, `${key}: ${rendered.join(', ')}`).toContainEqual(rendered)
      compared += 1
    }
    for (const section of apiSections(model))
      for (const listing of section.symbols) {
        const symbol = model.symbol(section.slug, listing.name)
        if (!symbol) continue
        for (const signature of symbol.signatures) check(symbol.name, symbol.name, signature.code)
        for (const member of symbol.members)
          for (const signature of member.signatures) check(`${symbol.name}.${member.name}`, member.name, signature.code)
      }
    // Every generic decorator, helper and method among them, so a check of nothing can't pass
    expect(compared).toBeGreaterThan(30)
  })
})
