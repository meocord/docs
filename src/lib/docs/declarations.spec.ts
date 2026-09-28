import { readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
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

const text = (tokens: Token[]) => tokens.map(token => token.text).join('')

/**
 * A declaration as TypeScript parses it, as one string: each node's kind with its children, in order, and
 * each leaf's text. Parentheses that group nothing are unwrapped, so `(A | B)[]` and `A | B[]` still differ.
 * Parameter names are compared, a destructured one by the name its `@param` gives it, as the reference
 * draws it. A string's quotes, and `export` and `declare`, are left out.
 */
function shape(node: ts.Node, source: ts.SourceFile): string {
  if (ts.isParenthesizedTypeNode(node)) return shape(node.type, source)
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return `'${node.text}'`
  const children: string[] = []
  ts.forEachChild(node, child => {
    if (ts.isParameter(node) && child === node.name && !ts.isIdentifier(child)) {
      // A destructured parameter is drawn by the name its @param gives it at that position, where it has one
      children.push(paramTagName(node) ?? shape(child, source))
      return
    }
    // How a declaration is exported isn't drawn
    if (child.kind === ts.SyntaxKind.ExportKeyword || child.kind === ts.SyntaxKind.DeclareKeyword) return
    children.push(shape(child, source))
  })
  return children.length > 0 ? `${ts.SyntaxKind[node.kind]}(${children.join(',')})` : node.getText(source)
}

/** The name the top-level `@param` at a parameter's position gives it, if its declaration has one. */
function paramTagName(parameter: ts.ParameterDeclaration): string | undefined {
  const owner = parameter.parent
  const index = owner.parameters.indexOf(parameter)
  const names = ts
    .getJSDocTags(owner)
    .filter(ts.isJSDocParameterTag)
    .map(tag => tag.name.getText())
    .filter(name => !name.includes('.'))
  return names[index]
}

/** One line of the reference's code, parsed in the place its declaration sits. */
function parsed(owner: 'interface' | 'class' | 'function', line: string, ownerName = ''): string {
  // A constructor is drawn as the call that makes its own class, `new X(…)`; TypeScript declares it `constructor(…)`
  const written = line.startsWith(`new ${ownerName}(`) ? `constructor(${line.slice(`new ${ownerName}(`.length)}` : line
  const wrapped =
    owner === 'function'
      ? `declare function ${written}`
      : owner === 'interface'
        ? `interface Owner {\n${written}\n}`
        : `declare class Owner {\n${written}\n}`
  const source = ts.createSourceFile('drawn.ts', wrapped, ts.ScriptTarget.Latest, true)
  const [statement] = source.statements
  const node =
    statement && (ts.isInterfaceDeclaration(statement) || ts.isClassDeclaration(statement))
      ? statement.members[0]
      : statement
  return node ? shape(node, source) : `unparsed: ${line}`
}

/** Every public interface's and class's members, by `Owner.member`, and every function's overloads, as declared. */
function declared(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  const add = (key: string, node: ts.Node, source: ts.SourceFile) =>
    found.set(key, [...(found.get(key) ?? []), shape(node, source)])
  for (const file of declarationFiles(path.join(pkgDir, 'dist', 'types'))) {
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
    const visit = (node: ts.Node) => {
      if (ts.isFunctionDeclaration(node) && node.name) add(node.name.text, node, source)
      if ((ts.isInterfaceDeclaration(node) || ts.isClassDeclaration(node)) && node.name)
        for (const member of node.members) {
          const name = member.name?.getText(source) ?? (ts.isConstructorDeclaration(member) ? 'constructor' : undefined)
          const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined
          if (!name || modifiers?.some(each => each.kind === ts.SyntaxKind.PrivateKeyword)) continue
          add(`${node.name.text}.${name}`, member, source)
        }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return found
}

describe('declarations', () => {
  it("draw every public member and every function's overloads as the pinned version declares them", async () => {
    const { apiModel, apiSections } = await import('@/lib/docs/api-site')
    const model = apiModel('4.1', version)!
    const written = declared()
    const wrong: string[] = []
    let compared = 0
    for (const section of apiSections(model))
      for (const listing of section.symbols) {
        const symbol = model.symbol(section.slug, listing.name)
        if (!symbol) continue
        const lines: [string, 'interface' | 'class' | 'function', Token[][]][] =
          symbol.kind === 'function'
            ? [[symbol.name, 'function', symbol.code]]
            : symbol.kind === 'interface' || symbol.kind === 'class'
              ? symbol.members.map(member => [
                  `${symbol.name}.${member.kind === 'constructor' ? 'constructor' : member.name}`,
                  symbol.kind as 'interface' | 'class',
                  member.code,
                ])
              : []
        for (const [key, owner, code] of lines) {
          const expected = written.get(key)
          if (!expected) continue
          const drawn = code.map(line => parsed(owner, text(line), symbol.name))
          if (JSON.stringify(drawn) !== JSON.stringify(expected))
            wrong.push(`${key}:\n    drawn    ${code.map(text).join('\n             ')}`)
          compared += 1
        }
      }
    expect(compared).toBeGreaterThan(300)
    expect(wrong).toEqual([])
  })
})
