import { createMockClient, MeoCordTestingModule } from 'meocord/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReminderScheduler } from '@src/services/reminder.scheduler'

describe('lifecycle hooks in a test', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  // #region lifecycle
  it('runs onReady once the module is ready, and onShutdown on close', async () => {
    const client = createMockClient()
    const module = await MeoCordTestingModule.create({
      providers: [{ provide: ReminderScheduler, useClass: ReminderScheduler }],
    })
      .compile()
      .init({ ready: { client } })
    module.get(ReminderScheduler).add('111111111111111111', 'Water the plants')

    await vi.advanceTimersByTimeAsync(60_000)
    await module.close()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(client.users.send).toHaveBeenCalledTimes(1)
  })
  // #endregion lifecycle
})
