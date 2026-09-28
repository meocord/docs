import { describe, expect, it } from 'vitest'
import {
  isRunStarted,
  isSnowflake,
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
          { kind: 'userselect', customId: 'assign/7', users: ['13', '14'], extra: 1 },
          { kind: 'reaction', emoji: '⭐', content: 'nice', action: 'remove', extra: 1 },
          { kind: 'event', event: 'guildMemberAdd', args: ['x'] },
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
        { kind: 'userselect', customId: 'assign/7', users: ['13', '14'] },
        { kind: 'reaction', emoji: '⭐', content: 'nice', action: 'remove' },
        { kind: 'event', event: 'guildMemberAdd' },
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
      [run({ source: 1 }), 'the code is text'],
      [run({ source: 'x\uD800' }), 'the code is text'],
      [run({ source: 'x'.repeat(MAX_SOURCE_LENGTH + 1) }), `the code is over 64,000 characters, the most a run takes`],
      [run({ dispatch: 'x' }), `a run dispatches a list of up to ${MAX_STEPS} inputs`],
      [
        run({ dispatch: Array.from({ length: MAX_STEPS + 1 }, () => ({ kind: 'button', customId: 'x' })) }),
        'a run dispatches a list of up to 20 inputs',
      ],
      [run({ dispatch: [1] }), 'each dispatch is an object'],
      [
        run({ dispatch: [{ kind: 'eval' }] }),
        'a dispatch is slash, button, select, userselect, modal, message, reaction or event',
      ],
      [run({ dispatch: [{ kind: 'userselect', users: ['1'] }] }), 'a user select menu names its customId'],
      [
        run({ dispatch: [{ kind: 'userselect', customId: 'x', users: ['me'] }] }),
        "a user select menu's users are 1 to 25 different snowflakes",
      ],
      [
        run({ dispatch: [{ kind: 'userselect', customId: 'x', users: [] }] }),
        "a user select menu's users are 1 to 25 different snowflakes",
      ],
      [run({ dispatch: [{ kind: 'reaction', content: 'x', action: 'add' }] }), 'a reaction names its emoji'],
      [
        run({ dispatch: [{ kind: 'reaction', emoji: '⭐', content: 1, action: 'add' }] }),
        "a reaction's message has its content",
      ],
      [
        run({ dispatch: [{ kind: 'reaction', emoji: '⭐', content: 'x', action: 'toggle' }] }),
        "a reaction's action is add or remove",
      ],
      [run({ dispatch: [{ kind: 'event', event: 'clientReady' }] }), 'an event is guildMemberAdd or guildMemberRemove'],
      [run({ dispatch: [{ kind: 'slash', command: '' }] }), 'a slash dispatch names its command'],
      [run({ dispatch: [{ kind: 'slash', command: 'x', options: [] }] }), "a slash dispatch's options are an object"],
      [
        run({ dispatch: [{ kind: 'slash', command: 'x', options: { a: {} } }] }),
        'option a is a string, a number or a boolean',
      ],
      [run({ dispatch: [{ kind: 'button' }] }), 'a button names its customId'],
      [
        run({ dispatch: [{ kind: 'select', customId: 'x', values: [1] }] }),
        "a select menu's values are up to 25 different strings",
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
      [run({ caller: { username: 'x'.repeat(33) } }), "the caller's username is 1 to 32 characters"],
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

describe('the shapes every input shares', () => {
  const sparse = (length: number, ...set: [number, string][]) => {
    const list: string[] = new Array(length)
    for (const [index, value] of set) list[index] = value
    return list
  }
  const one = (dispatch: Record<string, unknown>) => parseRunRequest(run({ dispatch: [dispatch] }))

  it('refuses a list with a hole, in a request and in a result, for select values and user select users', () => {
    const inputs = [
      { kind: 'select', customId: 'pick', values: sparse(3, [0, 'a']) },
      { kind: 'userselect', customId: 'assign/7', users: sparse(5) },
      { kind: 'userselect', customId: 'assign/7', users: sparse(2, [0, '13']) },
    ]
    for (const input of inputs) {
      expect(typeof one(input), JSON.stringify(input)).toBe('string')
      const step = { input, ran: true, handlers: [], calls: [] }
      expect(parseRunResult({ type: 'result', id: 3, ok: true, steps: [step], logs: [] }, 3)).toBeUndefined()
    }
    // A hole among the dispatches, the handlers or the controllers fails the same way
    expect(parseRunRequest(run({ dispatch: sparse(2) }))).toBe('each dispatch is an object')
    expect(parseRunRequest(run({ controllers: sparse(2, [0, 'A']) }))).toBe('controllers are export names')
    const holed = { input: { kind: 'button', customId: 'x' }, ran: true, handlers: sparse(2, [0, 'A.a']), calls: [] }
    expect(parseRunResult({ type: 'result', id: 3, ok: true, steps: [holed], logs: [] }, 3)).toBeUndefined()
  })

  it('refuses a lone surrogate in every text an input carries', () => {
    const lone = '\uD800'
    const cases: [Record<string, unknown>, string][] = [
      [{ kind: 'reaction', emoji: lone, content: 'x', action: 'add' }, 'a reaction names its emoji'],
      [{ kind: 'reaction', emoji: '⭐', content: `hi ${lone}`, action: 'add' }, "a reaction's message has its content"],
      [{ kind: 'message', content: lone }, 'a message has its content'],
      [{ kind: 'button', customId: `a${lone}` }, 'a button names its customId'],
      [{ kind: 'select', customId: 'pick', values: [lone] }, "a select menu's values are up to 25 different strings"],
      [{ kind: 'modal', customId: 'form', fields: { about: lone } }, "a modal's fields are strings by custom ID"],
      [{ kind: 'modal', customId: 'form', fields: { [lone]: 'x' } }, "a modal's fields are strings by custom ID"],
      [{ kind: 'slash', command: lone }, 'a slash dispatch names its command'],
      [{ kind: 'slash', command: 'x', options: { note: lone } }, 'option note is a string, a number or a boolean'],
      [{ kind: 'slash', command: 'x', options: { [lone]: 1 } }, 'an option is named in 1 to 32 characters'],
    ]
    for (const [input, reason] of cases) expect(one(input), JSON.stringify(input)).toBe(reason)
    expect(parseRunRequest(run({ caller: { username: lone } }))).toBe("the caller's username is 1 to 32 characters")
  })

  it('takes a snowflake as Discord writes one, for the users and the caller alike', () => {
    for (const id of ['1', '13', '100000000000000001', '18446744073709551615']) {
      expect(isSnowflake(id), id).toBe(true)
      expect(one({ kind: 'userselect', customId: 'x', users: [id] }), id).toMatchObject({ dispatch: [{ users: [id] }] })
      expect(parseRunRequest(run({ caller: { userId: id } })), id).toMatchObject({ caller: { userId: id } })
    }
    for (const id of ['0', '007', '18446744073709551616', '123456789012345678901', '-1', '1e3', ' 13', 13]) {
      expect(isSnowflake(id), String(id)).toBe(false)
      expect(one({ kind: 'userselect', customId: 'x', users: [id] }), String(id)).toBe(
        "a user select menu's users are 1 to 25 different snowflakes",
      )
      expect(parseRunRequest(run({ caller: { userId: id } })), String(id)).toBe("the caller's userId is a snowflake")
    }
  })

  it('refuses a user or a value picked twice, and an empty custom ID wherever one is named', () => {
    expect(one({ kind: 'userselect', customId: 'x', users: ['13', '13'] })).toBe(
      "a user select menu's users are 1 to 25 different snowflakes",
    )
    expect(one({ kind: 'select', customId: 'x', values: ['a', 'a'] })).toBe(
      "a select menu's values are up to 25 different strings",
    )
    expect(one({ kind: 'button', customId: '' })).toBe('a button names its customId')
    expect(one({ kind: 'select', customId: '', values: [] })).toBe('a select menu names its customId')
    expect(one({ kind: 'userselect', customId: '', users: ['13'] })).toBe('a user select menu names its customId')
    expect(one({ kind: 'modal', customId: '', fields: {} })).toBe('a modal names its customId')
    expect(one({ kind: 'modal', customId: 'form', fields: { '': 'x' } })).toBe(
      "a modal's fields are strings by custom ID",
    )
    expect(one({ kind: 'button', customId: 'x'.repeat(101) })).toBe('a button names its customId')
  })
})
