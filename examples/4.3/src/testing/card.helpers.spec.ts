import { GuardDeniedError } from 'meocord/common'
import { getResponse, type TestingModule } from 'meocord/testing'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeModule, pressButton } from '@src/testing/card.helpers'

const OWNER = '111111111111111111'
const STRANGER = '222222222222222222'

// #region spec
describe('the card buttons', () => {
  let module: TestingModule
  beforeEach(() => {
    module = makeModule()
  })
  afterEach(() => module.close())

  it('refreshes the card for its owner', async () => {
    const { ran, click } = await pressButton(module, `card/${OWNER}/refresh`, OWNER)

    expect(ran).toBe(true)
    // @Defer acknowledges the click and locks the card; the handler's edit, the refreshed card, comes last
    const calls = getResponse(click).calls
    expect(calls.map(call => call.method)).toEqual(['deferUpdate', 'editReply', 'editReply'])
    expect(calls.at(-1)?.payload).toMatchObject({ embeds: [{ title: 'Refreshed' }] })
  })

  it('refuses anyone else', async () => {
    const { ran, error } = await pressButton(module, `card/${OWNER}/refresh`, STRANGER)

    expect(ran).toBe(false)
    expect(error).toBeInstanceOf(GuardDeniedError)
  })
})
// #endregion spec
