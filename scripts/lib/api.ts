/**
 * The API reference of a published version: TypeDoc over the declaration files its `exports` map
 * names, one module per entry point, serialised as JSON without anything that names the unpacked
 * tarball's paths or the bundler's chunk files.
 */

import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { Application, LogLevel, normalizePath, TSConfigReader, type JSONOutput } from 'typedoc'

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
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk)
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>
    delete record.sources
    // A reference into a bundler chunk names the chunk's file, such as dist/types/errors-DwvuoFVM.d.ts
    delete record.packagePath
    for (const value of Object.values(record)) walk(value)
  }
  walk(clean)
  return clean as JSONOutput.ProjectReflection
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
