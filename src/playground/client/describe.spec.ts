import { describe, expect, it } from 'vitest'
import { describeInput, summarizeCall } from './describe'
import { parseDispatchList } from '../dispatch-list'

describe('describeInput', () => {
  it('writes each input as a dispatch step, which reads back as the same input', () => {
    const written =
      "/settings notify email enabled:true count:3 note:'hi there'; button counter/1; select pick a,'b c'; modal feedback about='bugs, lots' name=ada; message !ping now; userselect assign/7 13,14; reaction ⭐ on 'nice post'; reaction remove 👍 on hi; event guildMemberAdd"
    const list = parseDispatchList(written)
    if (typeof list === 'string') throw new Error(list)
    const described = list.steps.map(describeInput)
    expect(described).toEqual([
      "/settings notify email enabled:true count:3 note:'hi there'",
      'button counter/1',
      "select pick a,'b c'",
      "modal feedback about='bugs, lots' name=ada",
      'message !ping now',
      'userselect assign/7 13,14',
      "reaction ⭐ on 'nice post'",
      'reaction remove 👍 on hi',
      'event guildMemberAdd',
    ])
    expect(parseDispatchList(described.join('; '))).toEqual(list)
  })
})

describe('summarizeCall', () => {
  it('reads a reply as its text, embeds, buttons and who sees it', () => {
    expect(summarizeCall({ method: 'reply', payload: 'pong' })).toBe('pong')
    expect(
      summarizeCall({
        method: 'reply',
        payload: {
          content: 'Pick one',
          embeds: [{ data: { title: 'Poll' } }, { title: 'Rules' }, { description: 'untitled' }],
          components: [
            { components: [{ data: { label: 'Yes', custom_id: 'y' } }, { label: 'No' }] },
            { components: [{ data: { placeholder: 'More…' } }] },
          ],
          flags: 64,
        },
      }),
    ).toBe('Pick one · 3 embeds: Poll, Rules · buttons and menus: Yes, No, More… · only the caller sees it')
    expect(summarizeCall({ method: 'reply', payload: { content: 'x', ephemeral: true } })).toBe(
      'x · only the caller sees it',
    )
    expect(summarizeCall({ method: 'update', payload: { components: [{ components: [{ label: 42 }] }] } })).toBe(
      'buttons and menus: 42',
    )
  })

  it('says a call failed, clips long text, and has nothing for a call that sends nothing', () => {
    expect(summarizeCall({ method: 'reply', error: 'Unknown interaction' })).toBe('failed: Unknown interaction')
    expect(summarizeCall({ method: 'reply', payload: 'x'.repeat(500) })).toBe(`${'x'.repeat(159)}…`)
    expect(summarizeCall({ method: 'deferReply' })).toBe('')
    expect(summarizeCall({ method: 'reply', payload: [1, 2] })).toBe('')
    expect(summarizeCall({ method: 'reply', payload: { embeds: [{}] } })).toBe('1 embed')
  })
})
