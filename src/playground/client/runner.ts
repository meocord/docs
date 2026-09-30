/**
 * Runs a page's playground: loaded the first time a reader presses Run, never before. It embeds the line's
 * sandboxed frame, hidden, once per frame, posts each run to it one at a time, checks each answer as the
 * frame checks the Worker's, and shows the result under the code.
 */
import { type FrameMessage, parseRunResult, type RunRequest, type RunResult } from '../runtime/protocol'
import { showResult, showStatus } from './result-view'

/**
 * How long the frame may take to say it is ready. It says so as its own small script runs, before it loads the
 * runtime and compiler, which it bounds itself, so only a frame that never loads takes this long.
 */
const READY_LIMIT = 10_000
/**
 * How long after the frame's document loads its ready message may still arrive: the two reach the page as
 * separate tasks, in either order. A document that loads without saying it is ready is not the frame.
 */
const LOADED_GRACE = 2_000
/** How long a run may take to be answered, loading included; the frame stops runs well within it. */
const ANSWER_LIMIT = 90_000

/** A request as the page renders it, less the id each run is given. */
export type PageRequest = Omit<RunRequest, 'type' | 'id'>

interface Channel {
  run(request: PageRequest): Promise<RunResult>
}

const channels = new Map<string, Promise<Channel>>()
let nextId = 1

function openChannel(frame: string): Promise<Channel> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.title = 'MeoCord playground runner'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.tabIndex = -1
  iframe.setAttribute('data-playground-frame', '')
  // Out of sight, not display:none, which an engine may take as leave to skip loading it
  iframe.style.cssText =
    'position:fixed;inset:auto auto 0 0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;clip-path:inset(50%)'
  iframe.src = frame
  const waiting = new Map<number, (message: unknown) => void>()
  let ready: () => void
  const readied = new Promise<void>(resolve => (ready = resolve))
  const listening = new AbortController()
  addEventListener(
    'message',
    event => {
      if (event.source !== iframe.contentWindow) return
      const message = event.data as FrameMessage | undefined
      if (message?.type === 'ready') ready()
      else if (message?.type === 'result' && typeof message.id === 'number') waiting.get(message.id)?.(message)
    },
    { signal: listening.signal },
  )

  // The frame takes one run at a time, so runs from every playground on the page wait their turn
  let queue: Promise<unknown> = Promise.resolve()
  const channel: Channel = {
    run(request) {
      const id = nextId++
      const answered = queue.then(
        () =>
          new Promise<RunResult>((resolve, reject) => {
            const timer = setTimeout(() => {
              waiting.delete(id)
              reject(new Error('The playground took too long to answer.'))
            }, ANSWER_LIMIT)
            waiting.set(id, message => {
              const result = parseRunResult(message, id)
              if (!result) return
              clearTimeout(timer)
              waiting.delete(id)
              resolve(result)
            })
            iframe.contentWindow?.postMessage({ type: 'run', id, ...request }, '*')
          }),
      )
      queue = answered.catch(() => undefined)
      return answered
    },
  }
  // A frame that isn't ready is dropped with its listener, so the next Run starts a fresh one
  const starting = new AbortController()
  const opened = new Promise<Channel>((resolve, reject) => {
    const timers: ReturnType<typeof setTimeout>[] = []
    const settle = () => {
      timers.forEach(clearTimeout)
      starting.abort()
    }
    const giveUp = (reason: string) => {
      settle()
      listening.abort()
      if (channels.get(frame) === opened) channels.delete(frame)
      iframe.remove()
      reject(new Error(`The playground couldn't start: ${reason} Press Run to try again.`))
    }
    const blocked = () =>
      giveUp("its frame didn't load, so a browser extension, the network or the site's settings may be blocking it.")
    timers.push(setTimeout(() => giveUp(`its frame didn't load within ${READY_LIMIT / 1000} seconds.`), READY_LIMIT))
    iframe.addEventListener('load', () => timers.push(setTimeout(blocked, LOADED_GRACE)), { signal: starting.signal })
    iframe.addEventListener('error', blocked, { signal: starting.signal })
    void readied.then(() => {
      settle()
      resolve(channel)
    })
    document.body.append(iframe)
  })
  return opened
}

/**
 * Runs `request` in the line's frame at `frame`, showing progress on `button` and the result in `output`.
 * A press while a run is under way is ignored.
 */
export async function runRequest(
  frame: string,
  request: PageRequest,
  output: HTMLElement,
  button: HTMLButtonElement,
): Promise<void> {
  if (button.getAttribute('aria-busy') === 'true') return
  const label = button.textContent
  button.setAttribute('aria-busy', 'true')
  button.textContent = 'Running…'
  showStatus(output, 'Running…')
  try {
    let channel = channels.get(frame)
    if (!channel) channels.set(frame, (channel = openChannel(frame)))
    showResult(output, await (await channel).run(request))
  } catch (error) {
    showStatus(output, error instanceof Error ? error.message : String(error), true)
  } finally {
    button.removeAttribute('aria-busy')
    button.textContent = label
  }
}

/** Runs the playground `embed` holds, showing progress on its Run button and the result in its output. */
export async function runEmbed(embed: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const output = embed.querySelector<HTMLElement>('[data-playground-output]')
  const frame = embed.dataset.playgroundSrc
  if (!output || !frame) return
  await runRequest(frame, JSON.parse(embed.dataset.playgroundRequest ?? '') as PageRequest, output, button)
}
