/**
 * The API reference of a published version: TypeDoc over the declaration files its `exports` map
 * names, one module per entry point, serialised as JSON without anything that names the unpacked
 * tarball's paths or the bundler's chunk files.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'fs'
import path from 'path'
import {
  Application,
  Converter,
  LogLevel,
  normalizePath,
  type ParameterReflection,
  TSConfigReader,
  type JSONOutput,
} from 'typedoc'
import semver from 'semver'
import ts from 'typescript'

export interface ApiMeta {
  package: string
  version: string
  integrity: string
  /** The commit the provenance attests, when the version has one. */
  commit?: string
  typedoc: string
}

export interface ApiDocument {
  meta: ApiMeta
  project: JSONOutput.ProjectReflection
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

/** Runs TypeDoc over an unpacked package and returns its API document. */
/** This repository's own install, where the packages a documented package leans on are found. */
const REPOSITORY_MODULES = path.resolve(import.meta.dirname, '..', '..', 'node_modules')

/**
 * Links a package's peer dependencies, discord.js among them, from this repository's install into its
 * node_modules, so the types it names from them resolve rather than read as `any`. A peer the
 * repository lacks, or holds outside the package's range, fails the generation, naming it.
 */
function linkPeers(packageDir: string): void {
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')) as {
    peerDependencies?: Record<string, string>
  }
  for (const [name, range] of Object.entries(manifest.peerDependencies ?? {})) {
    const installed = path.join(REPOSITORY_MODULES, name)
    if (!existsSync(path.join(installed, 'package.json')))
      throw new Error(`${name} ${range}, a peer of the package, isn't installed here: add it to devDependencies.`)
    const { version } = JSON.parse(readFileSync(path.join(installed, 'package.json'), 'utf8')) as { version: string }
    if (!semver.satisfies(version, range))
      throw new Error(`${name}@${version} is installed here, outside the package's peer range ${range}.`)
    const link = path.join(packageDir, 'node_modules', name)
    if (existsSync(link)) continue
    mkdirSync(path.dirname(link), { recursive: true })
    symlinkSync(realpathSync(installed), link, 'dir')
  }
}

/** Whether a type as written names a type alias, directly or in a union or an intersection. */
function namesAlias(node: ts.TypeNode, checker: ts.TypeChecker): boolean {
  if (ts.isUnionTypeNode(node) || ts.isIntersectionTypeNode(node))
    return node.types.some(part => namesAlias(part, checker))
  if (!ts.isTypeReferenceNode(node)) return false
  const symbol = checker.getSymbolAtLocation(node.typeName)
  const target = symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
  return !!target && !!(target.flags & ts.SymbolFlags.TypeAlias)
}

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
      entryPoints: files,
      entryPointStrategy: 'resolve',
      tsconfig,
      // The package's peers, discord.js among them, are not installed: their types stay references
      skipErrorChecking: true,
      disableSources: true,
      excludeExternals: true,
      excludePrivate: true,
      excludeInternal: true,
      readme: 'none',
      plugin: [],
      logLevel: LogLevel.Error,
    },
    [new TSConfigReader()],
  )
  // TypeDoc draws a return type from the checker, which resolves a conditional alias, `DeepMocked<T>`,
  // into its branch: the alias is lost, and its `infer`s read as unbound names. A return written with an
  // alias's name, alone or within a union or an intersection, is drawn as written instead.
  app.converter.on(Converter.EVENT_CREATE_SIGNATURE, (context, reflection, declaration) => {
    const node = declaration && 'type' in declaration ? declaration.type : undefined
    if (node && ts.isTypeNode(node) && namesAlias(node, context.checker))
      reflection.type = context.converter.convertType(context.withScope(reflection), node)
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
  return { meta: { ...meta, typedoc: Application.VERSION }, project: json }
}
