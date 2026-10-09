import { ChatInputCommandInteraction, User } from 'discord.js'
import { CooldownError } from 'meocord/common'
import { createMockInteraction, inspectHandler, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { DailySlashController } from '@src/controllers/slash/daily.slash.controller'

const from = (id: string) =>
  createMockInteraction(ChatInputCommandInteraction, { user: createMockInteraction(User, { id }) })

describe('DailySlashController', () => {
  // #region spec
  it('refuses a second call within three seconds, per user', async () => {
    // Each testing module counts in a fresh store
    const module = MeoCordTestingModule.create({ controllers: [DailySlashController] }).compile()

    await module.invoke(DailySlashController, 'daily', from('1'))

    await expect(module.invoke(DailySlashController, 'daily', from('1'))).rejects.toBeInstanceOf(CooldownError)
    await expect(module.invoke(DailySlashController, 'daily', from('2'))).resolves.toEqual({ ran: true })
  })

  it('lists its cooldowns with their defaults', () => {
    expect(inspectHandler(DailySlashController, 'daily').cooldowns).toEqual([
      expect.objectContaining({ seconds: 3, uses: 1, per: 'user' }),
      expect.objectContaining({ seconds: 60, uses: 5, per: 'user' }),
    ])
  })
  // #endregion spec
})
