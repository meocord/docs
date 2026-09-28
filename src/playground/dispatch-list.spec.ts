import { describe, expect, it } from 'vitest'
import { parseDispatchList } from './dispatch-list'

describe('parseDispatchList', () => {
  it('reads every kind of step, as a reader would send it', () => {
    expect(
      parseDispatchList(
        "/settings notify email enabled:true count:3 ratio:-0.5 note:'hi there; again' id:abc; button counter/1; select pick a,'b c'; modal feedback about='bugs, lots' name=ada; message !ping 'now'",
      ),
    ).toEqual({
      steps: [
        {
          kind: 'slash',
          command: 'settings notify email',
          options: { enabled: true, count: 3, ratio: -0.5, note: 'hi there; again', id: 'abc' },
        },
        { kind: 'button', customId: 'counter/1' },
        { kind: 'select', customId: 'pick', values: ['a', 'b c'] },
        { kind: 'modal', customId: 'feedback', fields: { about: 'bugs, lots', name: 'ada' } },
        { kind: 'message', content: "!ping 'now'" },
      ],
    })
    expect(parseDispatchList('/ping')).toEqual({ steps: [{ kind: 'slash', command: 'ping' }] })
    expect(parseDispatchList("message 'hello there'")).toEqual({ steps: [{ kind: 'message', content: 'hello there' }] })
  })

  it('reads a user select, a reaction and a gateway event', () => {
    expect(
      parseDispatchList(
        "userselect assign/7 13,14; reaction ⭐ on 'nice post'; reaction remove 👍; reaction add ⭐ on hi there; event guildMemberAdd",
      ),
    ).toEqual({
      steps: [
        { kind: 'userselect', customId: 'assign/7', users: ['13', '14'] },
        { kind: 'reaction', emoji: '⭐', content: 'nice post', action: 'add' },
        { kind: 'reaction', emoji: '👍', content: 'A message to react to.', action: 'remove' },
        { kind: 'reaction', emoji: '⭐', content: 'hi there', action: 'add' },
        { kind: 'event', event: 'guildMemberAdd' },
      ],
    })
  })

  it('sets the caller from a first `as` step', () => {
    expect(parseDispatchList("as dm user:13 name:'Ada L'; /ping")).toEqual({
      caller: { inGuild: false, userId: '13', username: 'Ada L' },
      steps: [{ kind: 'slash', command: 'ping' }],
    })
  })

  it('refuses a list it cannot run, naming the step and why', () => {
    const cases: [string, string][] = [
      ['', 'dispatch: names no step'],
      [' ; ', 'dispatch: names no step'],
      ["message 'open", 'dispatch: a quote is left open'],
      ['/ping;', 'dispatch step 2: is empty'],
      ['/', 'dispatch step 1: a slash command names its command after the /'],
      ['/a b c d', 'dispatch step 1: a slash command is a command, a subcommand group and a subcommand at most'],
      ['/ping n:1 extra', 'dispatch step 1: "extra" follows the options; the command\'s path comes first'],
      ['/ping; select', 'dispatch step 2: select needs a customId'],
      ['select pick', 'dispatch step 1: a select step is `select <customId> <value>,<value>`'],
      ['button', 'dispatch step 1: a button step is `button <customId>`'],
      ['modal', 'dispatch step 1: modal needs a customId'],
      [
        'modal f about',
        'dispatch step 1: "about" is not a field; a modal step is `modal <customId> <field>=\'<text>\'`',
      ],
      ['message', 'dispatch step 1: a message step is `message <content>`'],
      [
        'click x',
        'dispatch step 1: "click" starts no step; a step is /command, button, select, userselect, modal, message, reaction or event',
      ],
      ['userselect', 'dispatch step 1: userselect needs a customId'],
      ['userselect assign/7', 'dispatch step 1: a userselect step is `userselect <customId> <userId>,<userId>`'],
      ['userselect assign/7 me', "dispatch: a user select menu's users are 1 to 25 different snowflakes"],
      ['reaction', 'dispatch step 1: a reaction step is `reaction <emoji> on <message>`'],
      [
        'reaction ⭐ to hi',
        'dispatch step 1: "to" follows the emoji; a reaction step is `reaction <emoji> on <message>`',
      ],
      ['reaction ⭐ on', 'dispatch step 1: a reaction step names its message after `on`'],
      ['event', 'dispatch step 1: an event step is `event <name>`, one of guildMemberAdd, guildMemberRemove'],
      [
        'event clientReady',
        'dispatch step 1: "clientReady" is no event a run emits; it emits guildMemberAdd, guildMemberRemove',
      ],
      ['/ping; as dm', 'dispatch step 2: `as` sets the caller for the whole run, so it comes first'],
      ['as', 'dispatch step 1: an `as` step names the caller: `as dm`, `as user:13 name:ada`'],
      [
        'as admin; /ping',
        'dispatch step 1: "admin" is not a caller; a caller is `as dm`, `user:<id>` or `name:<name>`',
      ],
      ['as dm', 'dispatch: names no step to run'],
      [Array.from({ length: 21 }, () => 'button x').join('; '), 'dispatch: names 21 steps, over the 20 a run takes'],
      [`button ${'x'.repeat(101)}`, 'dispatch: a button names its customId'],
      [`as name:${'x'.repeat(33)}; /ping`, "dispatch: the caller's username is 1 to 32 characters"],
    ]
    for (const [text, reason] of cases) expect(parseDispatchList(text), text).toBe(reason)
  })
})
