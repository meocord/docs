import { ChatInputCommandInteraction } from 'discord.js'
import { CooldownError } from 'meocord/common'
import { createMockInteraction, createMockUser, MeoCordTestingModule } from 'meocord/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DailySlashController } from '@src/controllers/slash/daily.slash.controller'

const from = (id: string) => createMockInteraction(ChatInputCommandInteraction, { user: createMockUser({ id }) })

describe('a cooldown over time', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // #region time
  it('lets the user in again once the three seconds have passed', async () => {
    const module = MeoCordTestingModule.create({ controllers: [DailySlashController] }).compile()
    await module.invoke(DailySlashController, 'daily', from('1'))

    await expect(module.invoke(DailySlashController, 'daily', from('1'))).rejects.toBeInstanceOf(CooldownError)
    await vi.advanceTimersByTimeAsync(3_000)

    await expect(module.invoke(DailySlashController, 'daily', from('1'))).resolves.toEqual({ ran: true })
  })
  // #endregion time
})
