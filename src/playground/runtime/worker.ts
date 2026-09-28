import initSwc, { transformSync } from '@swc/wasm-web'
import { type LogLine, parseRunRequest, type RunResult } from './protocol'
import { type ModuleMap, runPlayground } from './run'

/** What the frame sets before it loads the runtime: where swc's WebAssembly is, as an absolute URL. */
interface Boot {
  wasm: string
}

type WorkerScope = typeof globalThis & {
  __playground?: Boot
  postMessage(message: unknown): void
  onmessage: ((event: MessageEvent) => void) | null
}

const LEVELS = ['log', 'info', 'warn', 'error', 'debug'] as const
// Logger colours its lines for a terminal; the result view shows them plain
const ANSI = /\u001b\[[0-9;]*m/g

const text = (value: unknown) => {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack ?? `${value.name}: ${value.message}`
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

/** Sends what the console receives during a run to that run's logs. */
function captureConsole(sink: () => LogLine[] | undefined) {
  for (const level of LEVELS) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      const logs = sink()
      if (logs && logs.length < 500) logs.push({ level, text: args.map(text).join(' ').replace(ANSI, '') })
      else if (!logs) original(...args)
    }
  }
}

/**
 * Starts the playground Worker over a line's pinned modules: each message the frame forwards is parsed,
 * compiled with swc as a generated app's build compiles it, and run through MeoCord's dispatch. Runs
 * go one at a time, in the order they arrive.
 */
export function startWorker(modules: ModuleMap) {
  const scope = globalThis as WorkerScope
  let current: LogLine[] | undefined
  captureConsole(() => current)
  let swc: Promise<unknown> | undefined
  const compile = (source: string) =>
    transformSync(source, {
      filename: 'playground.ts',
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        // async/await lowered, so the async context follows every await
        target: 'es2016',
      },
      module: { type: 'commonjs' },
    }).code

  let queue: Promise<void> = Promise.resolve()
  scope.onmessage = event => {
    queue = queue.then(async () => {
      const request = parseRunRequest(event.data)
      const logs: LogLine[] = []
      if (typeof request === 'string') {
        const id = typeof event.data?.id === 'number' ? event.data.id : -1
        scope.postMessage({
          type: 'result',
          id,
          ok: false,
          stage: 'request',
          message: request,
          logs,
        } satisfies RunResult)
        return
      }
      current = logs
      try {
        const wasm = scope.__playground?.wasm
        if (!wasm) throw new Error('The playground runtime was loaded without its compiler.')
        swc ??= initSwc(wasm)
        await swc
        scope.postMessage(await runPlayground(request, { modules, compile, logs }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        scope.postMessage({
          type: 'result',
          id: request.id,
          ok: false,
          stage: 'compile',
          message,
          logs,
        } satisfies RunResult)
      } finally {
        current = undefined
      }
    })
  }
}
