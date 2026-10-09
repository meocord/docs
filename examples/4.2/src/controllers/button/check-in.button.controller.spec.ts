import { ButtonInteraction, User } from 'discord.js'
import { CooldownError, GuardDeniedError } from 'meocord/common'
import { createMockInteraction, inspectHandler, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { CheckInButtonController } from '@src/controllers/button/check-in.button.controller'

const click = (userId: string, customId: string) =>
  createMockInteraction(ButtonInteraction, { customId, user: createMockInteraction(User, { id: userId }) })

describe('CheckInButtonController', () => {
  // #region spec
  it('checks each account in once an hour, on its own', async () => {
    const module = MeoCordTestingModule.create({ controllers: [CheckInButtonController] }).compile()

    await module.invoke(CheckInButtonController, 'checkIn', click('1', 'check-in/1/800000001'))

    // The same account again is refused; another of the user's accounts is not
    await expect(
      module.invoke(CheckInButtonController, 'checkIn', click('1', 'check-in/1/800000001')),
    ).rejects.toBeInstanceOf(CooldownError)
    await expect(
      module.invoke(CheckInButtonController, 'checkIn', click('1', 'check-in/1/800000002')),
    ).resolves.toEqual({
      ran: true,
    })
  })

  it("refuses someone else's button before the cooldown, which it does not spend", async () => {
    const module = MeoCordTestingModule.create({ controllers: [CheckInButtonController] }).compile()

    await expect(
      module.invoke(CheckInButtonController, 'checkIn', click('2', 'check-in/1/800000001')),
    ).rejects.toBeInstanceOf(GuardDeniedError)
    await expect(
      module.invoke(CheckInButtonController, 'checkIn', click('1', 'check-in/1/800000001')),
    ).resolves.toEqual({
      ran: true,
    })
  })

  it('reports that its cooldown counts by a value of the call', () => {
    expect(inspectHandler(CheckInButtonController, 'checkIn').cooldowns).toEqual([
      expect.objectContaining({ seconds: 3600, per: 'user', by: true }),
    ])
  })
  // #endregion spec
})
