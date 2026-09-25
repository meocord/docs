import { ButtonInteraction } from 'discord.js'
import { createMockInteraction, getResponse, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { AccountButtonController } from '@src/controllers/button/account.button.controller'
import { AccountPipe } from '@src/pipes/account.pipe'
import { AccountService } from '@src/services/account.service'

describe('AccountButtonController', () => {
  const module = MeoCordTestingModule.create({
    controllers: [AccountButtonController],
    providers: [
      { provide: AccountPipe, useClass: AccountPipe },
      { provide: AccountService, useClass: AccountService },
    ],
  }).compile()

  it('receives what the pipe made of the validated uid', async () => {
    const interaction = createMockInteraction(ButtonInteraction, { customId: 'account/800000001' })

    await module.invoke(AccountButtonController, 'show', interaction)

    expect(getResponse(interaction).calls[0].payload).toMatchObject({ content: 'Account of Ada' })
  })
})
