import { describe, expect, it } from 'vitest'
import {
  isRunStarted,
  MAX_RESULT_LENGTH,
  MAX_SOURCE_LENGTH,
  MAX_STEPS,
  parseRunRequest,
  parseRunResult,
} from './protocol'

const run = (extra: Record<string, unknown> = {}) => ({
  type: 'run',
  id: 1,
  source: 'export {}',
  dispatch: [],
  ...extra,
})

describe('parseRunRequest', () => {
  it('keeps the fields a run reads, and only those', () => {
    const parsed = parseRunRequest(
      run({
        dispatch: [
          {
            kind: 'slash',
            command: 'settings notify email',
            options: { enabled: true, times: 3, note: 'hi' },
            extra: 1,
          },
          { kind: 'button', customId: 'counter/1' },
          { kind: 'select', customId: 'pick', values: ['a'] },
          { kind: 'modal', customId: 'form', fields: { about: 'bugs' } },
          { kind: 'message', content: '!ping' },
        ],
        caller: { userId: '13', username: 'ada', inGuild: false, admin: true },
        controllers: ['Ping'],
        evil: 'ignored',
      }),
    )
    expect(parsed).toEqual({
      type: 'run',
      id: 1,
      source: 'export {}',
      dispatch: [
        { kind: 'slash', command: 'settings notify email', options: { enabled: true, times: 3, note: 'hi' } },
        { kind: 'button', customId: 'counter/1' },
        { kind: 'select', customId: 'pick', values: ['a'] },
        { kind: 'modal', customId: 'form', fields: { about: 'bugs' } },
        { kind: 'message', content: '!ping' },
      ],
      caller: { userId: '13', username: 'ada', inGuild: false },
      controllers: ['Ping'],
    })
    expect(parseRunRequest(run({ dispatch: [{ kind: 'slash', command: 'ping' }] }))).toMatchObject({
      dispatch: [{ kind: 'slash', command: 'ping' }],
    })
  })

  it('refuses anything that is not a well-formed run request, saying why', () => {
    const cases: [unknown, string][] = [
      [null, 'not a run request'],
      [{ type: 'result' }, 'not a run request'],
      [run({ id: '1' }), 'a run request has a numeric id'],
      [run({ id: 1.5 }), 'a run request has a numeric id'],
      [
        run({ source: 1 }),
        `the code is over ${MAX_SOURCE_LENGTH.toLocaleString('en')} characters, the most a run takes`,
      ],
      [run({ source: 'x'.repeat(MAX_SOURCE_LENGTH + 1) }), `the code is over 64,000 characters, the most a run takes`],
      [run({ dispatch: 'x' }), `a run dispatches a list of up to ${MAX_STEPS} inputs`],
      [
        run({ dispatch: Array.from({ length: MAX_STEPS + 1 }, () => ({ kind: 'button', customId: 'x' })) }),
        'a run dispatches a list of up to 20 inputs',
      ],
      [run({ dispatch: [1] }), 'each dispatch is an object'],
      [run({ dispatch: [{ kind: 'eval' }] }), 'a dispatch is slash, button, select, modal or message'],
      [run({ dispatch: [{ kind: 'slash', command: '' }] }), 'a slash dispatch names its command'],
      [run({ dispatch: [{ kind: 'slash', command: 'x', options: [] }] }), "a slash dispatch's options are an object"],
      [
        run({ dispatch: [{ kind: 'slash', command: 'x', options: { a: {} } }] }),
        'option a is a string, a number or a boolean',
      ],
      [run({ dispatch: [{ kind: 'button' }] }), 'a button names its customId'],
      [
        run({ dispatch: [{ kind: 'select', customId: 'x', values: [1] }] }),
        "a select menu's values are up to 25 strings",
      ],
      [run({ dispatch: [{ kind: 'select', values: [] }] }), 'a select menu names its customId'],
      [
        run({ dispatch: [{ kind: 'modal', customId: 'x', fields: { a: 1 } }] }),
        "a modal's fields are strings by custom ID",
      ],
      [run({ dispatch: [{ kind: 'modal', fields: {} }] }), 'a modal names its customId'],
      [run({ dispatch: [{ kind: 'message' }] }), 'a message has its content'],
      [run({ caller: 'me' }), 'the caller is an object'],
      [run({ caller: { userId: 'abc' } }), "the caller's userId is a snowflake"],
      [run({ caller: { username: 'x'.repeat(33) } }), "the caller's username is up to 32 characters"],
      [run({ caller: { inGuild: 'yes' } }), "the caller's inGuild is true or false"],
      [run({ controllers: [1] }), 'controllers are export names'],
    ]
    for (const [data, reason] of cases) expect(parseRunRequest(data)).toBe(reason)
  })
})

const step = (extra: Record<string, unknown> = {}) => ({
  input: { kind: 'button', customId: 'counter/1' },
  ran: true,
  handlers: ['Counter.add'],
  calls: [{ method: 'update', payload: { content: 'Count: 1' } }],
  ...extra,
})
const result = (extra: Record<string, unknown> = {}) => ({
  type: 'result',
  id: 3,
  ok: true,
  steps: [step()],
  logs: [{ level: 'info', text: 'ready' }],
  ...extra,
})

describe('parseRunResult', () => {
  it("rebuilds a run's result from the fields a result has, as plain JSON", () => {
    const parsed = parseRunResult(
      result({
        steps: [
          step({
            error: { name: 'UserError', message: 'Link first.', stack: 'at x' },
            calls: [{ method: 'reply', payload: { when: new Date(0), content: 'hi' }, extra: 1 }],
            extra: '<img>',
          }),
        ],
        truncated: true,
        html: '<script>',
      }),
      3,
    )
    expect(parsed).toEqual({
      type: 'result',
      id: 3,
      ok: true,
      steps: [
        {
          input: { kind: 'button', customId: 'counter/1' },
          ran: true,
          handlers: ['Counter.add'],
          error: { name: 'UserError', message: 'Link first.' },
          calls: [{ method: 'reply', payload: { when: '1970-01-01T00:00:00.000Z', content: 'hi' } }],
        },
      ],
      logs: [{ level: 'info', text: 'ready' }],
      truncated: true,
    })
    expect(parseRunResult({ type: 'result', id: 3, ok: false, stage: 'load', message: 'No fs.', logs: [] }, 3)).toEqual(
      { type: 'result', id: 3, ok: false, stage: 'load', message: 'No fs.', logs: [] },
    )
  })

  it('refuses what is not a result for the run, whoever posted it', () => {
    const cases: unknown[] = [
      null,
      'result',
      { type: 'navigate', url: 'https://example.com' },
      result({ id: 4 }),
      result({ ok: 'yes' }),
      result({ steps: 'x' }),
      result({ steps: Array.from({ length: MAX_STEPS + 1 }, () => step()) }),
      result({ steps: [step({ input: { kind: 'eval' } })] }),
      result({ steps: [step({ ran: 1 })] }),
      result({ steps: [step({ handlers: [1] })] }),
      result({ steps: [step({ error: 'x' })] }),
      result({ steps: [step({ calls: [{ payload: 1 }] })] }),
      result({ steps: [step({ calls: [{ method: 'reply', error: 1 }] })] }),
      result({ logs: [{ level: 'trace', text: 'x' }] }),
      result({ logs: 'x' }),
      result({ truncated: false }),
      result({ steps: [step({ calls: [{ method: 'reply', payload: 'x'.repeat(MAX_RESULT_LENGTH) }] })] }),
      { type: 'result', id: 3, ok: false, stage: 'network', message: 'x', logs: [] },
      { type: 'result', id: 3, ok: false, stage: 'load', message: 1, logs: [] },
    ]
    for (const data of cases) expect(parseRunResult(data, 3)).toBeUndefined()
  })
})

describe('isRunStarted', () => {
  it('knows the start of the run it waits for, and nothing else', () => {
    expect(isRunStarted({ type: 'started', id: 3 }, 3)).toBe(true)
    expect(isRunStarted({ type: 'started', id: 2 }, 3)).toBe(false)
    expect(isRunStarted({ type: 'result', id: 3 }, 3)).toBe(false)
    expect(isRunStarted(null, 3)).toBe(false)
  })
})
