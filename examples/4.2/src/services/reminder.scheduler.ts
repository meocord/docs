// #region scheduler
import { type Client } from 'discord.js'
import { Service } from 'meocord/decorator'
import { type OnReady, type OnShutdown, type ReadyInfo } from 'meocord/interface'

@Service()
export class ReminderScheduler implements OnReady, OnShutdown {
  private readonly due: { userId: string; text: string }[] = []
  private timer?: ReturnType<typeof setInterval>

  add(userId: string, text: string) {
    this.due.push({ userId, text })
  }

  onReady(client: Client<true>, { primary }: ReadyInfo) {
    // With sharding, only the process running shard 0 sends reminders
    if (primary) this.timer = setInterval(() => void this.send(client), 60_000)
  }

  onShutdown() {
    clearInterval(this.timer)
  }

  private async send(client: Client<true>) {
    for (const { userId, text } of this.due.splice(0)) await client.users.send(userId, text)
  }
}
// #endregion scheduler
