/**
 * The playground's frame: a document sandboxed to an opaque origin, which runs a reader's code in a Worker
 * and passes requests and results between it and the page. The page's request is parsed before the Worker
 * sees it; the Worker's answer is rebuilt from a result's fields before the page does, since the reader's
 * code runs in that Worker and can post too. Each run gets a Worker of its own, stopped as its answer is sent,
 * whether that is its result, a result the reader's code forged, or the `RUN_TIME_LIMIT` running out: nothing a
 * Worker posts can keep it alive, and no run inherits another's timers, globals or patches.
 */
import {
  type FrameMessage,
  isRunStarted,
  parseRunRequest,
  parseRunResult,
  RUN_TIME_LIMIT,
  type RunRequest,
  type RunResult,
} from '../runtime/protocol'

/** How long the runtime and compiler may take to load before a run starts, on a slow connection. */
const LOAD_TIME_LIMIT = 60_000

const script = document.currentScript as HTMLScriptElement
// The frame's origin is opaque; the page that embeds it is on the site the frame was served from
const site = new URL(location.href).origin
const runtime = new URL(script.dataset.runtime!, site).href
const wasm = new URL(script.dataset.wasm!, site).href

const toPage = (message: FrameMessage) => parent.postMessage(message, site)

interface Pending {
  id: number
  worker: Worker
  /** The Worker's script, kept until the run ends: WebKit reads it after the Worker is made. */
  url: string
  timer: ReturnType<typeof setTimeout>
  started: boolean
}

let pending: Pending | undefined

const failure = (id: number, stage: 'request' | 'timeout' | 'runtime', message: string): RunResult => ({
  type: 'result',
  id,
  ok: false,
  stage,
  message,
  logs: [],
})

/** Answers the run in progress and stops its Worker. */
function finish(result: RunResult) {
  if (!pending || result.id !== pending.id) return
  clearTimeout(pending.timer)
  pending.worker.terminate()
  URL.revokeObjectURL(pending.url)
  pending = undefined
  toPage(result)
}

function startWorker(): { worker: Worker; url: string } {
  const boot = `self.__playground = { wasm: ${JSON.stringify(wasm)} }; importScripts(${JSON.stringify(runtime)})`
  const url = URL.createObjectURL(new Blob([boot], { type: 'text/javascript' }))
  const worker = new Worker(url)
  worker.onmessage = (event: MessageEvent) => {
    if (!pending || pending.worker !== worker) return
    if (isRunStarted(event.data, pending.id) && !pending.started) {
      const { id } = pending
      pending.started = true
      clearTimeout(pending.timer)
      pending.timer = setTimeout(
        () =>
          finish(
            failure(
              id,
              'timeout',
              `The code ran for more than ${RUN_TIME_LIMIT / 1000} seconds, so the playground stopped it.`,
            ),
          ),
        RUN_TIME_LIMIT,
      )
      return
    }
    const result = parseRunResult(event.data, pending.id)
    if (result) finish(result)
  }
  worker.onerror = event => {
    event.preventDefault()
    if (pending?.worker === worker && !pending.started)
      finish(
        failure(
          pending.id,
          'runtime',
          `The playground couldn't start: ${event.message || 'its runtime failed to load'}.`,
        ),
      )
  }
  return { worker, url }
}

function run(request: RunRequest) {
  if (pending) {
    toPage(failure(request.id, 'request', 'A run is already in progress; wait for its result.'))
    return
  }
  const { id } = request
  const { worker, url } = startWorker()
  pending = {
    id,
    worker,
    url,
    started: false,
    timer: setTimeout(
      () => finish(failure(id, 'runtime', "The playground's runtime took too long to load.")),
      LOAD_TIME_LIMIT,
    ),
  }
  worker.postMessage(request)
}

addEventListener('message', (event: MessageEvent) => {
  if (event.source !== parent || event.origin !== site) return
  const request = parseRunRequest(event.data)
  if (typeof request === 'string') {
    const id = typeof event.data?.id === 'number' && Number.isSafeInteger(event.data.id) ? event.data.id : -1
    toPage(failure(id, 'request', request))
    return
  }
  run(request)
})

toPage({ type: 'ready' })
