import { ButtonInteraction } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { createMockInteraction, createMockUser, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { PollButtonController } from '@src/controllers/button/poll.button.controller'

describe('PollButtonController', () => {
  const module = MeoCordTestingModule.create({ controllers: [PollButtonController] }).compile()
  const author = createMockUser({ id: '111111111111111111' })
  const stranger = createMockUser({ id: '222222222222222222' })
  const click = (customId: string, user = author) => createMockInteraction(ButtonInteraction, { customId, user })

  // #region owner
  it('lets in only the user the route names, and tells anyone else why', async () => {
    const results = 'poll/7/111111111111111111/results'
    await expect(module.invoke(PollButtonController, 'results', click(results))).resolves.toEqual({ ran: true })
    await expect(module.invoke(PollButtonController, 'results', click(results, stranger))).rejects.toThrow(
      new GuardDeniedError('Only the user who opened this can use it.'),
    )

    const close = 'poll/7/111111111111111111/close'
    await expect(module.invoke(PollButtonController, 'close', click(close))).resolves.toEqual({ ran: true })
    await expect(module.invoke(PollButtonController, 'close', click(close, stranger))).rejects.toThrow(
      new GuardDeniedError('Only the author can close this poll.'),
    )
  })
  // #endregion owner
})
