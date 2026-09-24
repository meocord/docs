---
id: lifecycle-hooks
title: "Lifecycle Hooks"
order: 21
source: readme@4.1.0-beta.0
---

A controller or service can do work once the bot is online, and clean up before it stops, by implementing `OnReady` and `OnShutdown` from `meocord/interface`:

```typescript
import { Service } from 'meocord/decorator'
import { type OnReady, type OnShutdown, type ReadyInfo } from 'meocord/interface'
import { type Client } from 'discord.js'

@Service()
export class ReminderScheduler implements OnReady, OnShutdown {
  private timer?: ReturnType<typeof setInterval>

  onReady(client: Client<true>, { primary }: ReadyInfo) {
    if (primary) this.timer = setInterval(() => void this.sendDueReminders(client), 60_000)
  }

  onShutdown() {
    clearInterval(this.timer)
  }

  private async sendDueReminders(client: Client<true>) {
    for (const { userId, text } of this.takeDue()) await client.users.send(userId, text)
  }

  private takeDue(): { userId: string; text: string }[] {
    return [] // read the reminders that are due from your store
  }
}
```

- **Which classes**: every controller and every service the app binds — the ones listed in `@MeoCord({ controllers, services })` and everything they depend on — including a service no handler has used yet. Guards are created per call and get no hooks.
- **`onReady`** runs once the client is ready. It receives the client and `{ primary }`, which says whether this process should do one-off work: `true` for a bot running in one process, and with [process sharding](/docs/4.1/deployment#sharding) only in the process running shard 0.
- **Dependency order.** `onReady` hooks run one at a time, each class after the classes it injects: a `DatabaseService` is ready before the `ReminderScheduler` that injects it. Classes with no dependency between them run in declaration order, the `services` first, then the `controllers`. Command registration runs alongside and never delays the hooks. A hook still running after 10 seconds is named in a warning, and the hooks after it wait for it.
- **`onShutdown`** runs on SIGINT or SIGTERM, before the client is destroyed, in reverse order, so a class stops before the classes it uses. The bot waits for the whole sequence up to `shutdownTimeout` from `meocord.config.ts` (10 seconds by default), then shuts down whether or not it finished. A second signal more than a second after the first exits at once; one sooner is taken as the same request, since a terminal's Ctrl+C can arrive twice. If the bot never became ready, for example because the login failed, no `onShutdown` hook runs. A signal that arrives while the `onReady` hooks are still running shuts down only the classes whose `onReady` finished, and those without one; the class still starting, and those after it, are skipped, and no further `onReady` starts.
- A hook that throws is logged and the next one still runs. When a class's `onReady` failed, the classes that depend on it still run theirs, with a warning naming the failed dependency.

---
