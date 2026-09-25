---
id: lifecycle-hooks
title: Lifecycle hooks
section: Beyond commands
order: 52
since: 4.1.0
---

A controller or service does work once the bot is online, and cleans up before it stops, by implementing
`OnReady` and `OnShutdown` from `meocord/interface`:

::example{file="services/reminder.scheduler.ts" region="scheduler"}

## Which classes

Every controller and service the app binds: the ones listed in `@MeoCord({ controllers, services })`, and
everything they depend on, including a service no handler has used yet. Guards are created per call and get
no hooks.

## onReady

`onReady` runs once the client is ready. It receives the client and `{ primary }`, which says whether this
process should do one-off work: `true` for a bot running in one process, and with process sharding only in
the process running shard 0.

The hooks run one at a time, each class after the classes it injects, so a `DatabaseService` is ready before
the scheduler that injects it. Classes with no dependency between them run in declaration order, the
`services` first, then the `controllers`. Command registration runs alongside and never delays them. A hook
still running after 10 seconds is named in a warning, and the hooks after it wait for it.

## onShutdown

`onShutdown` runs on SIGINT or SIGTERM, before the client is destroyed, in reverse order, so a class stops
before the classes it uses. The bot waits for the whole sequence up to `shutdownTimeout` in
[`meocord.config.ts`](/docs/4.1/configuration), 10 seconds by default, then shuts down whether or not it
finished.

- A second signal more than a second after the first exits at once; one sooner is taken as the same request,
  since a terminal's Ctrl+C can arrive twice.
- If the bot never became ready, because the login failed, say, no `onShutdown` hook runs.
- A signal that arrives while the `onReady` hooks are still running shuts down only the classes whose
  `onReady` finished, and those without one. No further `onReady` starts.

## Failures

A hook that throws is logged, and the next one still runs. When a class's `onReady` failed, the classes that
depend on it still run theirs, with a warning naming the failed dependency.

## Testing

The testing module does not run hooks. Call them directly, as the bot would:

::example{file="services/reminder.scheduler.spec.ts" region="spec"}
