import { describe, expect, it } from 'vitest'
import { MAX_SOURCE_LENGTH, MAX_STEPS, parseRunRequest } from './protocol'

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
