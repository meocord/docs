/**
 * A run's inputs and Discord calls as the result view words them: one line each, the way a reader would
 * write the input and read the reply. Pure, so what a reader sees is tested without a browser.
 */
import type { Dispatch, RecordedCall } from '../runtime/protocol'

const quoted = (text: string) => (/[\s,;=:]/.test(text) ? `'${text}'` : text)

/** An input as a `dispatch` step writes it: `/settings notify email enabled:true`, `reaction ⭐ on 'hello'`. */
export function describeInput(input: Dispatch): string {
  switch (input.kind) {
    case 'slash': {
      const options = Object.entries(input.options ?? {}).map(
        ([name, value]) => `${name}:${typeof value === 'string' ? quoted(value) : String(value)}`,
      )
      return [`/${input.command}`, ...options].join(' ')
    }
    case 'button':
      return `button ${input.customId}`
    case 'select':
      return `select ${input.customId} ${input.values.map(quoted).join(',')}`
    case 'modal':
      return [
        `modal ${input.customId}`,
        ...Object.entries(input.fields).map(([name, value]) => `${name}=${quoted(value)}`),
      ].join(' ')
    case 'userselect':
      return `userselect ${input.customId} ${input.users.join(',')}`
    case 'message':
      return `message ${input.content}`
    case 'reaction':
      return `reaction ${input.action === 'remove' ? 'remove ' : ''}${input.emoji} on ${quoted(input.content)}`
    case 'event':
      return `event ${input.event}`
  }
}

const EPHEMERAL = 1 << 6
const MAX_TEXT = 160

const clipped = (text: string) => (text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text)

const record = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined

/** A builder's JSON sits under `data` in some shapes and at the top in others. */
const fields = (value: unknown) => {
  const outer = record(value)
  return { ...outer, ...record(outer?.data) }
}

/** The labels of the buttons and menus in a message's rows. */
function componentLabels(components: unknown): string[] {
  if (!Array.isArray(components)) return []
  return components.flatMap(row => {
    const inner = fields(row).components
    return (Array.isArray(inner) ? inner : [row]).flatMap(component => {
      const { label, placeholder, custom_id: customId } = fields(component)
      const name = label ?? placeholder ?? customId
      return typeof name === 'string' || typeof name === 'number' ? [String(name)] : []
    })
  })
}

/**
 * What a call sent, in a line: its text, its embeds by title, its buttons and menus by label, and whether
 * only the caller sees it. Empty for a call that sends nothing, such as `deferReply`.
 */
export function summarizeCall(call: RecordedCall): string {
  if (call.error !== undefined) return `failed: ${clipped(call.error)}`
  const { payload } = call
  if (typeof payload === 'string') return clipped(payload)
  const body = record(payload)
  if (!body) return ''
  const parts: string[] = []
  if (typeof body.content === 'string' && body.content) parts.push(clipped(body.content))
  if (Array.isArray(body.embeds) && body.embeds.length > 0) {
    const titles = body.embeds.map(embed => fields(embed).title).filter(title => typeof title === 'string')
    parts.push(
      `${body.embeds.length} embed${body.embeds.length === 1 ? '' : 's'}${titles.length ? `: ${clipped(titles.join(', '))}` : ''}`,
    )
  }
  const labels = componentLabels(body.components)
  if (labels.length > 0) parts.push(`buttons and menus: ${clipped(labels.join(', '))}`)
  const flags = typeof body.flags === 'number' ? body.flags : 0
  if (body.ephemeral === true || (flags & EPHEMERAL) !== 0) parts.push('only the caller sees it')
  return parts.join(' · ')
}

/** How the result view names the stage a run failed at. */
export const FAILED_STAGE_LABELS = {
  request: 'The playground refused the request',
  compile: "The code doesn't compile",
  load: 'The code failed to load',
  module: "The app couldn't be built",
  timeout: 'Stopped',
  runtime: "The playground couldn't run",
} as const
