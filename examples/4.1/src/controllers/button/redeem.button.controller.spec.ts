import { ButtonInteraction } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { RedeemAccountPipe, RedeemButtonController } from '@src/controllers/button/redeem.button.controller'
import { AuditLog } from '@src/services/audit-log.service'
import { AccountService } from '@src/services/account.service'

describe('RedeemButtonController', () => {
  const setup = () => {
    const module = MeoCordTestingModule.create({
      controllers: [RedeemButtonController],
      providers: [
        { provide: RedeemAccountPipe, useClass: RedeemAccountPipe },
        { provide: AccountService, useClass: AccountService },
        { provide: AuditLog, useClass: AuditLog },
      ],
    }).compile()
    return { module, audit: module.get(AuditLog) }
  }

  // #region spec
  it('records the params as the call sent them and as the handler ran with them', async () => {
    const { module, audit } = setup()

    await module.invoke(
      RedeemButtonController,
      'redeem',
      createMockInteraction(ButtonInteraction, { customId: 'redeem/800000001' }),
    )

    expect(audit.entries).toEqual([
      { handler: 'redeem', received: { uid: '800000001' }, ran: { uid: { uid: '800000001', name: 'Ada' } } },
    ])
  })

  it('answers a uid with no account from the params as they were when the pipe threw', async () => {
    const { module } = setup()
    const interaction = createMockInteraction(ButtonInteraction, { customId: 'redeem/800000009' })

    await module.invoke(RedeemButtonController, 'redeem', interaction)

    // Answered privately, as an error embed
    expect(getResponse(interaction).calls.at(-1)?.payload).toMatchObject({
      embeds: [expect.objectContaining({ description: 'There is no account 800000009.' })],
    })
  })
  // #endregion spec
})
