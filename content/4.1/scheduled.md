---
id: scheduled
title: Scheduled tasks
chapter: appendix
group: recipes
order: 5
summary: Post to a channel at a set time every day, from one process however the bot is sharded, and stop cleanly.
requires: [services, lifecycle-hooks]
api: [types/OnReady, types/OnShutdown, decorators/MeoCord, decorators/Service]
since: 4.1.0
formerly: [recipe-scheduled]
---

A digest posted to a channel every day at 09:00 UTC. A service starts the schedule once the bot is online and
stops it before the bot shuts down, through its [lifecycle hooks](guide:lifecycle-hooks), and only one process
posts, however the bot is sharded.

## The code

A function works out how long it is until the next run:

::example{file="recipes/scheduled/daily-digest.service.ts" region="schedule"}

The service sets one timeout at a time, from `onReady`, and clears it in `onShutdown`:

::example{file="recipes/scheduled/daily-digest.service.ts" region="service"}

Nothing injects the service, so list it in the app's `services`; see
[Services nothing injects](guide:services#services-nothing-injects).

## How it works

- **Once the bot is online.** `onReady` receives the client, ready to fetch the channel, and `{ primary }`.
- **One process posts.** With [process sharding](guide:sharding#a-process-per-shard), every shard's process
  runs the hook, and `primary` is `true` only in the one running shard 0. A bot in one process is always primary.
- **On time every day.** Each run schedules the next from the clock, so the digest stays at 09:00. A 24-hour
  interval would drift after a slow post or a machine that slept.
- **Stopping.** `onShutdown` clears the timeout, so a stopping bot starts no new post.
- **A quick hook.** `onReady` only sets the timeout and returns. The hooks run one at a time, so a hook that
  awaited the schedule would hold up every hook after it.

### Testing it

Vitest's fake timers move the clock to the minute before 09:00, and on through a day:

::example{file="recipes/scheduled/daily-digest.service.spec.ts" region="spec"}

## Variations

### Cron expressions

For schedules more complex than a time of day, a library such as `croner` works out the next run. Start it in
`onReady` and stop it in `onShutdown` the same way.

### Work that must not be lost

A timer lives in memory, so a bot that is down at 09:00 misses that day. Record the last run in
[a database](guide:recipes/database), and in `onReady` catch up on a run that was missed.

### Many schedules

Many schedules, such as a time of each server's own, fit one timer that wakes every minute and runs what is due.

## Next steps

- [Lifecycle hooks](guide:lifecycle-hooks): the order hooks run in, and what happens when one fails.
- [Sharding](guide:sharding): which process does what with a process per shard.
- [A database](guide:recipes/database): somewhere to keep the last run.
