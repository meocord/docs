/**
 * The API reference of a published version: TypeDoc over the declaration files its `exports` map
 * names, one module per entry point, serialised as JSON without anything that names the unpacked
 * tarball's paths or the bundler's chunk files.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'fs'
import path from 'path'
import {
  Application,
  Converter,
  LogLevel,
  normalizePath,
  DeclarationReflection,
  ParameterReflection,
  ReflectionKind,
  type SomeType,
  TSConfigReader,
  UnionType,
  type JSONOutput,
} from 'typedoc'
import semver from 'semver'
import { isComputedType } from '../../src/lib/docs/api-model.js'
import ts from 'typescript'

export interface ApiMeta {
  package: string
  version: string
  integrity: string
  /** The commit the provenance attests, when the version has one. */
  commit?: string
  typedoc: string
}

/** The names an entry point re-exports from one of discord.js's packages, which TypeDoc leaves out as external. */
export interface ApiReexport {
  entry: string
  /** The specifier they are re-exported from, as `discord.js`. */
  from: string
  values: string[]
  types: string[]
}

export interface ApiDocument {
  meta: ApiMeta
  project: JSONOutput.ProjectReflection
  /** Present only when an entry point re-exports from discord.js. */
  reexports?: ApiReexport[]
}

type ExportTarget = string | { types?: string; import?: string | { types?: string } }

/** The entry points and their `import` declaration files, as `{ 'meocord/core': 'dist/types/core/index.d.ts' }`. */
export function entryPoints(packageDir: string): Record<string, string> {
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
    name: string
    exports: Record<string, ExportTarget>
  }
  const entries: Record<string, string> = {}
  for (const [subpath, target] of Object.entries(manifest.exports)) {
    // Early 4.0 betas put `types` beside `import`; later versions nest it per condition
    const types =
      typeof target === 'object'
        ? ((typeof target.import === 'object' ? target.import.types : undefined) ?? target.types)
        : undefined
    if (types) entries[`${manifest.name}${subpath.slice(1)}`] = types.replace(/^\.\//, '')
  }
  return entries
}

/** Drops what names the machine or the bundle: absolute paths, source files and chunk names. */
export function stripLocal(project: JSONOutput.ProjectReflection): JSONOutput.ProjectReflection {
  const clean = structuredClone(project) as Omit<JSONOutput.ProjectReflection, 'symbolIdMap' | 'files'> & {
    symbolIdMap?: unknown
    files?: unknown
  }
  delete clean.symbolIdMap
  delete clean.files
  // TypeDoc numbers reflections from a counter that runs across conversions in one process; ids are
  // rebased on the project's so a document does not depend on what was converted before it
  const base = clean.id
  const walk = (node: unknown, key?: string): void => {
    if (Array.isArray(node)) {
      // Groups and categories list their children by id
      if (key === 'children' && node.every(item => typeof item === 'number'))
        node.forEach((id, i) => (node[i] = id >= base ? id - base : id))
      else node.forEach(item => walk(item))
      return
    }
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    delete record.sources
    // A reference into a bundler chunk names the chunk's file, such as dist/types/errors-DwvuoFVM.d.ts
    delete record.packagePath
    // References to symbols outside the project, such as lib's Error, have negative targets of their own
    if (typeof record.id === 'number' && record.id >= base) record.id -= base
    if (typeof record.target === 'number' && record.target >= base) record.target -= base
    for (const [name, value] of Object.entries(record)) walk(value, name)
  }
  walk(clean)
  return clean as JSONOutput.ProjectReflection
}

/** This repository's own install, where the packages a documented package leans on are found. */
const REPOSITORY_MODULES = path.resolve(import.meta.dirname, '..', '..', 'node_modules')

/** The packages whose names an entry point re-exports as discord.js's own: discord.js and its `@discordjs/*` packages. */
const DISCORD_PACKAGE = /^(?:discord\.js|@discordjs\/[^/]+)$/

/** The module an alias declaration names: the `from` of a re-export or of an import. */
function specifierOf(declaration: ts.Declaration | undefined): string | undefined {
  const statement =
    declaration && ts.isExportSpecifier(declaration)
      ? declaration.parent.parent
      : declaration && ts.isImportSpecifier(declaration)
        ? declaration.parent.parent.parent
        : undefined
  const specifier = statement?.moduleSpecifier
  return specifier && ts.isStringLiteral(specifier) ? specifier.text : undefined
}

/** The documented package: where it sits, and the name it refers to itself by. */
interface OwnPackage {
  root: string
  name: string
}

/**
 * Where `file` sits in the package, with `/` between its parts as the exports map writes them, or none for a
 * file outside it, such as a dependency's.
 */
function ownPath(own: OwnPackage, file: string): string | undefined {
  const relative = path.relative(own.root, realpathSync(file))
  // On Windows, a file on another drive than the package's comes back absolute
  if (path.isAbsolute(relative)) return undefined
  const parts = relative.split(path.sep)
  return parts[0] === '..' || parts.includes('node_modules') ? undefined : parts.join('/')
}

/** Whether `specifier` names the package's own files: a relative path, or the package by its own name. */
const isOwnSpecifier = (own: OwnPackage, specifier: string) =>
  specifier.startsWith('.') || packageOfSpecifier(specifier) === own.name

/**
 * The discord.js specifier that brings an entry's export in. The alias chain is followed through the
 * package's own files only, so a third-party package that re-exports discord.js isn't taken for the
 * package doing so. A hop into the package's own files that doesn't resolve fails, naming the file that
 * holds it, since what it hides can't be told; one into a dependency that isn't linked can't be
 * discord.js's and is left out.
 */
function discordSpecifier(
  checker: ts.TypeChecker,
  own: OwnPackage,
  entry: string,
  symbol: ts.Symbol,
): string | undefined {
  const seen = new Set<ts.Symbol>()
  for (let hop: ts.Symbol | undefined = symbol; hop && hop.flags & ts.SymbolFlags.Alias && !seen.has(hop);) {
    seen.add(hop)
    const declaration = hop.declarations?.[0]
    const file = declaration && ownPath(own, declaration.getSourceFile().fileName)
    if (!file) return undefined
    const specifier = specifierOf(declaration)
    if (specifier && DISCORD_PACKAGE.test(packageOfSpecifier(specifier) ?? '')) return specifier
    const next = checker.getImmediateAliasedSymbol(hop)
    if (specifier && isOwnSpecifier(own, specifier) && !next?.declarations?.length)
      throw new Error(`${entry} re-exports ${symbol.name} through ${specifier} in ${file}, which doesn't resolve.`)
    hop = next
  }
  return undefined
}

/** `symbol`'s own declaration, through any alias. */
const resolved = (checker: ts.TypeChecker, symbol: ts.Symbol) =>
  symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol

/**
 * The names `export * from` brings into `source` from discord.js's packages, directly or through local
 * chunks, each with the specifier that brings it in and what it resolves to. A star export that doesn't
 * resolve fails, as a named one does.
 */
function starExports(
  checker: ts.TypeChecker,
  own: OwnPackage,
  entry: string,
  source: ts.SourceFile,
  seen = new Set<ts.SourceFile>(),
): Map<string, { from: string; target: ts.Symbol }> {
  const found = new Map<string, { from: string; target: ts.Symbol }>()
  if (seen.has(source)) return found
  seen.add(source)
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause || !statement.moduleSpecifier) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    const specifier = statement.moduleSpecifier.text
    const discord = DISCORD_PACKAGE.test(packageOfSpecifier(specifier) ?? '')
    if (!discord && !isOwnSpecifier(own, specifier)) continue
    const reached = checker.getSymbolAtLocation(statement.moduleSpecifier)
    if (!reached && discord)
      throw new Error(`${entry} re-exports everything from ${specifier}, which doesn't resolve: link its peers first.`)
    if (!reached)
      throw new Error(
        `${entry} re-exports everything from ${specifier} in ${ownPath(own, source.fileName)}, which doesn't resolve.`,
      )
    if (discord) {
      for (const name of checker.getExportsOfModule(reached))
        if (!found.has(name.name)) found.set(name.name, { from: specifier, target: resolved(checker, name) })
      continue
    }
    const chunk = reached.valueDeclaration
    if (chunk && ts.isSourceFile(chunk))
      for (const [name, star] of starExports(checker, own, entry, chunk, seen))
        if (!found.has(name)) found.set(name, star)
  }
  return found
}

/**
 * What each entry point re-exports from discord.js's packages, by the specifier that brings each name
 * in, named or by `export *`, directly or through a local chunk, with each name a value or a type by what
 * it declares: a bundled declaration file lists both in one `export { … } from`. Needs the package's
 * peers linked; a name that doesn't resolve fails rather than being guessed.
 */
export function discordReexports(packageDir: string, entries = entryPoints(packageDir)): ApiReexport[] {
  const files = Object.entries(entries).map(([entry, file]) => [entry, path.join(packageDir, file)] as const)
  const own: OwnPackage = {
    root: realpathSync(packageDir),
    name: (JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as { name: string }).name,
  }
  const program = ts.createProgram(
    files.map(([, file]) => file),
    {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      skipLibCheck: true,
      noEmit: true,
      types: [],
    },
  )
  const checker = program.getTypeChecker()
  const found: ApiReexport[] = []
  for (const [entry, file] of files) {
    const source = program.getSourceFile(file)
    const moduleSymbol = source && checker.getSymbolAtLocation(source)
    if (!moduleSymbol) continue
    const byFrom = new Map<string, { values: string[]; types: string[] }>()
    const stars = starExports(checker, own, entry, source)
    for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
      const target = resolved(checker, symbol)
      // A name the entry declares or re-exports itself shadows the one a star export would bring
      const star = stars.get(symbol.name)
      const from = discordSpecifier(checker, own, entry, symbol) ?? (star?.target === target ? star.from : undefined)
      if (!from) continue
      if (!target.declarations?.length)
        throw new Error(`${entry} re-exports ${symbol.name} from ${from}, which doesn't resolve: link its peers first.`)
      const names = byFrom.get(from) ?? { values: [], types: [] }
      byFrom.set(from, names)
      // A name the package renames carries discord.js's own beside it
      const name = target.name === symbol.name ? symbol.name : `${symbol.name} (${target.name})`
      ;(target.flags & ts.SymbolFlags.Value ? names.values : names.types).push(name)
    }
    for (const [from, { values, types }] of [...byFrom].sort(([a], [b]) => a.localeCompare(b)))
      found.push({ entry, from, values: values.sort(), types: types.sort() })
  }
  return found
}

/** A declaration file, for `import` (`.d.ts`, `.d.mts`) or `require` (`.d.cts`). */
const DECLARATION_FILE = /\.d\.[cm]?ts$/

/** The package a module specifier names: `@scope/name` or `name`, without a subpath; none for a relative or `node:` one. */
function packageOfSpecifier(specifier: string): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('node:') || path.isAbsolute(specifier)) return undefined
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * The packages the declaration files a package ships import, re-export or reference, read as TypeScript reads them, so
 * a name in a comment doesn't count. Its own node_modules, where peers are linked, is left out.
 */
function declaredPackages(packageDir: string): Set<string> {
  const names = new Set<string>()
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') visit(full)
      } else if (DECLARATION_FILE.test(entry.name)) {
        const { importedFiles, typeReferenceDirectives } = ts.preProcessFile(readFileSync(full, 'utf8'), true, true)
        for (const { fileName } of [...importedFiles, ...typeReferenceDirectives]) {
          const name = packageOfSpecifier(fileName)
          if (name) names.add(name)
        }
      }
    }
  }
  visit(packageDir)
  return names
}

/**
 * Links a package's peer dependencies, discord.js among them, from this repository's install into its
 * node_modules, so the types it names from them resolve rather than read as `any`. A required peer the
 * repository lacks, or any peer it holds outside the package's range, fails the generation, naming it. So does
 * an optional peer it lacks that the package's declarations import. One they don't import is skipped: no type in
 * the API document comes from it.
 */
export function linkPeers(packageDir: string, modules = REPOSITORY_MODULES): void {
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
    peerDependenciesMeta?: Record<string, { optional?: boolean }>
  }
  let declared: Set<string> | undefined
  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    const installed = path.join(modules, name)
    if (!existsSync(path.join(installed, 'package.json'))) {
      if (manifest.peerDependenciesMeta?.[name]?.optional !== true)
        throw new Error(`${name} ${range}, a peer of the package, isn't installed here: add it to devDependencies.`)
      if (!(declared ??= declaredPackages(packageDir)).has(name)) continue
      throw new Error(
        `${name} ${range}, an optional peer the package's declarations import, isn't installed here: add it to devDependencies.`,
      )
    }
    const { version } = JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8')) as { version: string }
    if (!semver.satisfies(version, range))
      throw new Error(`${name}@${version} is installed here, outside the package's peer range ${range}.`)
    const link = path.join(packageDir, 'node_modules', name)
    if (existsSync(link)) continue
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(realpathSync(installed), link, 'dir')
  }
}

/** A union without its `undefined`, or the one type left. */
function withoutUndefined(type: SomeType): SomeType {
  if (type.type !== 'union') return type
  const types = type.types.filter(each => !(each.type === 'intrinsic' && each.name === 'undefined'))
  return types.length === 1 ? types[0]! : new UnionType(types)
}

/** Whether a type holds an object's properties itself, alone or in an intersection: what options are listed from. */
const spellsOutObject = (type: SomeType): boolean =>
  (type.type === 'reflection' && !type.declaration.signatures) ||
  (type.type === 'intersection' && type.types.some(spellsOutObject))

/** A destructured parameter as it binds: `{ dmOnly, quiet }`, each element by the name a caller passes. */
function bindingText(pattern: ts.BindingPattern): string {
  const names = pattern.elements.map(element => {
    if (ts.isOmittedExpression(element)) return ''
    const name = ts.isIdentifier(element.name)
      ? element.propertyName && ts.isIdentifier(element.propertyName)
        ? element.propertyName.text
        : element.name.text
      : bindingText(element.name)
    return `${element.dotDotDotToken ? '...' : ''}${name}`
  })
  return ts.isObjectBindingPattern(pattern) ? `{ ${names.join(', ')} }` : `[${names.join(', ')}]`
}

/** Runs TypeDoc over an unpacked package and returns its API document. */
export async function generateApi(packageDir: string, meta: Omit<ApiMeta, 'typedoc'>): Promise<ApiDocument> {
  const entries = entryPoints(packageDir)
  if (Object.keys(entries).length === 0)
    throw new Error(`${meta.package}@${meta.version} declares no types in its exports map.`)
  const files = Object.values(entries).map(file => path.join(packageDir, file))
  const tsconfig = path.join(packageDir, 'tsconfig.docs.json')
  writeFileSync(
    tsconfig,
    JSON.stringify({
      compilerOptions: {
        module: 'nodenext',
        moduleResolution: 'nodenext',
        target: 'es2022',
        skipLibCheck: true,
        noEmit: true,
        types: [],
      },
      files,
    }),
  )

  linkPeers(packageDir)
  const app = await Application.bootstrapWithPlugins(
    {
      // TypeDoc reads entry points as globs, which take `/` only: a Windows path's `\` would escape
      entryPoints: files.map(normalizePath),
      entryPointStrategy: 'resolve',
      tsconfig,
      // The package's peers, discord.js among them, are not installed: their types stay references
      skipErrorChecking: true,
      disableSources: true,
      excludeExternals: true,
      excludePrivate: true,
      excludeInternal: true,
      readme: 'none',
      // A recursive alias, such as Jsonified's nested conditionals, passes TypeDoc's default of 10 and turns into `...`
      maxTypeConversionDepth: 40,
      plugin: [],
      logLevel: LogLevel.Error,
    },
    [new TSConfigReader()],
  )
  // TypeDoc draws a return type from the checker, which resolves an alias into what it stands for, turns
  // `this` into the class, fills in default type arguments and reorders a union; it reads as written instead.
  // Parameter types read as written too; where the checker spelled a parameter out as an object, as it
  // does `ThemeOverride`, that stays beside it as `resolvedType`, which the reference lists options from
  const resolved = new Map<ParameterReflection | DeclarationReflection, SomeType>()
  // Kept when the checker spelled out an object the written type names, or resolved a computed type
  const keep = (
    reflection: ParameterReflection | DeclarationReflection,
    checked: SomeType | undefined,
    written: SomeType,
  ) => {
    if (!checked) return
    if (
      (spellsOutObject(checked) && !spellsOutObject(written)) ||
      (isComputedType(written) && !isComputedType(checked))
    )
      resolved.set(reflection, checked)
  }
  app.converter.on(Converter.EVENT_CREATE_SIGNATURE, (context, reflection, declaration) => {
    const node = declaration && 'type' in declaration ? declaration.type : undefined
    const scope = context.withScope(reflection)
    if (node && ts.isTypeNode(node)) reflection.type = context.converter.convertType(scope, node)
    for (const parameter of reflection.parameters ?? []) {
      const written = context.getSymbolFromReflection(parameter)?.valueDeclaration
      if (!written || !ts.isParameter(written) || !written.type || written.type.kind === ts.SyntaxKind.ThisType)
        continue
      // The checker adds `undefined` to an optional parameter's type, which the written one says with its `?`
      const checked = parameter.type && written.questionToken ? withoutUndefined(parameter.type) : parameter.type
      parameter.type = context.converter.convertType(scope.withScope(parameter), written.type)
      keep(parameter, checked, parameter.type)
    }
  })
  // A property's type too, where TypeDoc took it from the checker rather than the written node
  // A member named by an expression, `[PIPED_BRAND]`, keys by what it evaluates to, a symbol, not a string;
  // TypeDoc names it `[PIPED_BRAND]` either way, so the declaration says which it is
  const computedNames = new Set<DeclarationReflection>()
  app.converter.on(Converter.EVENT_CREATE_DECLARATION, (context, reflection) => {
    const named = context.getSymbolFromReflection(reflection)?.valueDeclaration
    if (named && 'name' in named && named.name && ts.isComputedPropertyName(named.name as ts.Node))
      computedNames.add(reflection)
    if (reflection.kind !== ReflectionKind.Property) return
    const written = named
    if (!written || !(ts.isPropertySignature(written) || ts.isPropertyDeclaration(written)) || !written.type) return
    const scope = context.withScope(reflection)
    const type = context.converter.convertType(scope, written.type)
    // In a type TypeDoc drew from its node, a property's type is already as written: the checker's is asked for
    const symbol = context.getSymbolFromReflection(reflection)
    const checked =
      isComputedType(type) && symbol
        ? context.converter.convertType(scope, context.checker.getTypeOfSymbol(symbol))
        : reflection.type
    reflection.type = type
    keep(reflection, checked && reflection.flags.isOptional ? withoutUndefined(checked) : checked, reflection.type)
  })
  app.serializer.addSerializer<ParameterReflection | DeclarationReflection>({
    priority: 0,
    supports: item => item instanceof ParameterReflection || item instanceof DeclarationReflection,
    toObject: (item, object, serializer) => {
      const type = resolved.get(item)
      const withType = type ? { ...object, resolvedType: serializer.toObject(type) } : object
      return item instanceof DeclarationReflection && computedNames.has(item)
        ? { ...withType, computedName: true }
        : withType
    },
  })
  // A signature's type parameter comes from the checker, which reorders a union and fills in a type's
  // default arguments; its constraint and default read as the declaration writes them
  app.converter.on(Converter.EVENT_CREATE_TYPE_PARAMETER, (context, reflection) => {
    const declaration = context.getSymbolFromReflection(reflection)?.declarations?.find(ts.isTypeParameterDeclaration)
    if (!declaration) return
    const scope = context.withScope(reflection)
    if (declaration.constraint) reflection.type = context.converter.convertType(scope, declaration.constraint)
    if (declaration.default) reflection.default = context.converter.convertType(scope, declaration.default)
  })
  // TypeDoc names a destructured parameter `__namedParameters`, and a @param names it once resolving; one
  // no @param names reads as it binds, `{ dmOnly, quiet }`
  const bindings = new Map<ParameterReflection, string>()
  app.converter.on(Converter.EVENT_CREATE_PARAMETER, (context, reflection) => {
    const declaration = context.getSymbolFromReflection(reflection)?.valueDeclaration
    if (declaration && ts.isParameter(declaration) && !ts.isIdentifier(declaration.name))
      bindings.set(reflection, bindingText(declaration.name))
  })
  // TypeDoc lists members alphabetically. An interface's and an object type's read as they are declared, the
  // order their author chose, `controllers` and `clientOptions` first in @MeoCord's options; a reflection's
  // id is the order it was made in, which is its declaration's. After TypeDoc's own grouping, at -100.
  app.converter.on(
    Converter.EVENT_RESOLVE_END,
    context => {
      const byId = (a: { id: number }, b: { id: number }) => a.id - b.id
      for (const reflection of Object.values(context.project.reflections)) {
        if (!(reflection instanceof DeclarationReflection)) continue
        if (!reflection.kindOf(ReflectionKind.Interface | ReflectionKind.TypeLiteral)) continue
        // Every list of them the reflection holds, so a grouping or a category can't sort them again
        reflection.children?.sort(byId)
        for (const category of reflection.categories ?? []) category.children.sort(byId)
        for (const group of reflection.groups ?? []) {
          group.children.sort(byId)
          for (const category of group.categories ?? []) category.children.sort(byId)
        }
      }
    },
    -200,
  )
  app.converter.on(Converter.EVENT_RESOLVE_END, () => {
    for (const [reflection, binding] of bindings) if (reflection.name === '__namedParameters') reflection.name = binding
  })
  const project = await app.convert()
  if (!project) throw new Error(`TypeDoc could not convert ${meta.package}@${meta.version}.`)

  const json = stripLocal(app.serializer.projectToObject(project, normalizePath(packageDir)))
  // TypeDoc names each module after its file's path below the entry files' common directory;
  // readers import it by the entry point
  const modulePath = (file: string) => file.replace(/\.d\.c?ts$/, '').replace(/\/index$/, '')
  for (const child of json.children ?? []) {
    const match = Object.entries(entries).find(
      ([, file]) => modulePath(file) === child.name || modulePath(file).endsWith(`/${child.name}`),
    )
    if (match) child.name = match[0]
  }
  const missing = Object.keys(entries).filter(entry => !json.children?.some(child => child.name === entry))
  if (missing.length > 0)
    throw new Error(`TypeDoc produced no module for ${missing.join(', ')} in ${meta.package}@${meta.version}.`)
  json.name = meta.package
  const reexports = discordReexports(packageDir, entries)
  return { meta: { ...meta, typedoc: Application.VERSION }, project: json, ...(reexports.length > 0 && { reexports }) }
}
