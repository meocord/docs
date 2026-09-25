import { type Client } from 'discord.js'
import { createMockClient } from 'meocord/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReminderScheduler } from '@src/services/reminder.scheduler'

// #region spec
describe('ReminderScheduler', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('sends due reminders every minute from onReady until onShutdown', async () => {
    const client = createMockClient() as unknown as Client<true>
    const scheduler = new ReminderScheduler()
    scheduler.add('111111111111111111', 'Water the plants')

    scheduler.onReady(client, { primary: true })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(client.users.send).toHaveBeenCalledWith('111111111111111111', 'Water the plants')

    scheduler.onShutdown()
    scheduler.add('111111111111111111', 'Too late')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(client.users.send).toHaveBeenCalledTimes(1)
  })

  it('schedules nothing outside the primary process', async () => {
    const client = createMockClient() as unknown as Client<true>
    const scheduler = new ReminderScheduler()
    scheduler.add('111111111111111111', 'Water the plants')

    scheduler.onReady(client, { primary: false })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(client.users.send).not.toHaveBeenCalled()
  })
})
// #endregion spec
