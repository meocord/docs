---
id: recipe-scheduled
title: Scheduled tasks
section: Recipes
order: 74
since: 4.1.0
---

A digest posted to a channel every day at 09:00 UTC. It uses a service's
[lifecycle hooks](/docs/4.1/lifecycle-hooks) to start once the bot is online and to stop before it shuts
down, and `primary` so that a sharded bot posts once.

## When the next run is

::example{file="recipes/scheduled/daily-digest.service.ts" region="schedule"}

## The service

::example{file="recipes/scheduled/daily-digest.service.ts" region="service"}

- **`onReady`** starts the schedule, only when `primary` is `true`: with a process per shard, every process
  runs the hook, and only the one running shard 0 should post. See [Sharding](/docs/4.1/sharding).
- **One timeout at a time.** Each run schedules the next, from the clock, so the digest stays at 09:00.
- **`onShutdown`** clears the timeout, so a stopping bot starts no new post.

Nothing injects the service, so list it in `@MeoCord({ services })`; see
[Services and injection](/docs/4.1/services#services-nothing-injects).

## Testing it

Vitest's fake timers move the clock to the minute before 09:00 and on through a day:

::example{file="recipes/scheduled/daily-digest.service.spec.ts" region="spec"}

## Going further

- **Cron expressions.** For schedules more complex than a time of day, a library such as `croner` computes
  the next run; start it in `onReady` and stop it in `onShutdown` the same way.
- **Work that must not be lost.** A timer lives in memory, so a bot that is down at 09:00 misses that day.
  Record the last run in [a database](/docs/4.1/recipe-database), and in `onReady` catch up on a missed one.
- **Many schedules**, such as each server's own time, fit one timer that wakes every minute and runs what is
  due.
