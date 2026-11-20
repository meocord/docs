import { Client } from 'discord.js'
import { MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import { StatsService } from '@src/services/stats.service'

// #region spec
describe('StatsService', () => {
  it('adds up the guild counts; the testing module runs a call once, as one process', async () => {
    const module = MeoCordTestingModule.create({
      providers: [
        { provide: StatsService, useClass: StatsService },
        { provide: Client, useValue: { guilds: { cache: { size: 3 } } } },
      ],
    }).compile()

    await expect(module.get(StatsService).totalGuilds()).resolves.toBe(3)
  })
})
// #endregion spec
