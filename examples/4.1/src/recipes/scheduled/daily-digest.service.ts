import { type Client } from 'discord.js'
import { Service } from 'meocord/decorator'
import { type OnReady, type OnShutdown, type ReadyInfo } from 'meocord/interface'

// #region schedule
/** Milliseconds from `now` until the next `hour:minute` UTC, today or tomorrow. */
export function untilNext(hour: number, minute: number, now: Date): number {
  const next = new Date(now)
  next.setUTCHours(hour, minute, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  return next.getTime() - now.getTime()
}
// #endregion schedule

// #region service
// Posts a digest to one channel every day at 09:00 UTC
@Service()
export class DailyDigest implements OnReady, OnShutdown {
  private readonly channelId = process.env.DIGEST_CHANNEL_ID ?? ''
  private timer?: ReturnType<typeof setTimeout>

  onReady(client: Client<true>, { primary }: ReadyInfo) {
    // With a process per shard, every process runs this hook; only one should post
    if (primary) this.scheduleNext(client)
  }

  onShutdown() {
    clearTimeout(this.timer)
  }

  // A timeout to the next 09:00, set again after each run, stays on time where a 24-hour interval
  // would drift after a slow post or a machine that slept
  private scheduleNext(client: Client<true>) {
    this.timer = setTimeout(
      async () => {
        try {
          await this.post(client)
        } finally {
          this.scheduleNext(client)
        }
      },
      untilNext(9, 0, new Date()),
    )
  }

  private async post(client: Client<true>) {
    const channel = await client.channels.fetch(this.channelId)
    if (channel?.isSendable()) await channel.send({ content: `Today is ${new Date().toDateString()}.` })
  }
}
// #endregion service
