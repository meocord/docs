import { type Client, TextChannel } from 'discord.js'
import { createMockClient, createMockInteraction } from 'meocord/testing'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DailyDigest, untilNext } from '@src/recipes/scheduled/daily-digest.service'

// #region spec
describe('untilNext', () => {
  it('counts to today’s time, or tomorrow’s once it has passed', () => {
    expect(untilNext(9, 0, new Date('2026-09-25T08:30:00Z'))).toBe(30 * 60_000)
    expect(untilNext(9, 0, new Date('2026-09-25T09:00:00Z'))).toBe(24 * 60 * 60_000)
  })
})

describe('DailyDigest', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-25T08:59:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  // A client whose channel lookup finds a text channel the digest can post in
  function clientWithChannel() {
    const channel = createMockInteraction(TextChannel)
    channel.isSendable.mockReturnValue(true)
    const client = createMockClient()
    client.channels.fetch.mockResolvedValue(channel as never)
    return { client: client as unknown as Client<true>, channel }
  }

  it('posts at 09:00 UTC every day, from the primary process, until shutdown', async () => {
    const { client, channel } = clientWithChannel()
    const digest = new DailyDigest()

    digest.onReady(client, { primary: true })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(channel.send).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000)
    expect(channel.send).toHaveBeenCalledTimes(2)

    digest.onShutdown()
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000)
    expect(channel.send).toHaveBeenCalledTimes(2)
  })

  it('posts nothing from any other process', async () => {
    const { client, channel } = clientWithChannel()

    new DailyDigest().onReady(client, { primary: false })
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000)

    expect(channel.send).not.toHaveBeenCalled()
  })
})
// #endregion spec
