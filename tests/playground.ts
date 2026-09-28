/**
 * A line's playground run in Node, for the specs: the meocord, discord.js and reflect-metadata its
 * examples pin, as the line's runtime bundles them, and a compiler doing what swc does in the browser.
 */
import path from 'node:path'
import ts from 'typescript'
import type { ModuleMap } from '../src/playground/runtime/run'

const root = path.resolve(__dirname, '..')

/** The modules a reader's code may import, loaded from the line's examples. */
export async function pinnedModules(line: string): Promise<ModuleMap> {
  const pinned = path.join(root, 'examples', line, 'node_modules')
  await import(path.join(pinned, 'reflect-metadata/Reflect.js'))
  const entry = (name: string) => import(path.join(pinned, 'meocord/dist/esm', name, 'index.js'))
  return {
    'discord.js': await import(path.join(pinned, 'discord.js/src/index.js')),
    'meocord/common': await entry('common'),
    'meocord/decorator': await entry('decorator'),
    'meocord/enum': await entry('enum'),
    'meocord/interface': await entry('interface'),
    'meocord/testing': await entry('testing'),
    'reflect-metadata': {},
  }
}

/** Legacy decorators with their metadata, as CommonJS, as the runtime's swc compiles a reader's code. */
export function compile(source: string): string {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  })
  const error = diagnostics?.find(each => each.category === ts.DiagnosticCategory.Error)
  if (error) throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n'))
  return outputText
}
