---
id: lifecycle-hooks
title: Lifecycle hooks
chapter: messages
order: 5
summary: Start work once the bot is online, and stop it cleanly before the bot shuts down.
learn:
  - Run code when the bot is ready, with `OnReady`
  - Clean up before it stops, with `OnShutdown`
  - Know the order hooks run in, and what happens when one fails
requires: [services]
api: [types/OnReady, types/OnShutdown]
since: 4.1.0
---

A controller or service implements `OnReady` to do work once the bot is online, and `OnShutdown` to clean up
before it stops. The hooks run in dependency order, so a database is connected before the scheduler that uses
it, and closed after.

## When to use it

Use `onReady` for work that needs the client online: setting the bot's activity, starting a timer, warming a
cache. Use `onShutdown` to stop that work: clear timers, flush metrics, close connections.

For something to do in response to Discord, use [gateway events](guide:gateway-events) instead.

## Example

::example{file="services/reminder.scheduler.ts" region="scheduler"}

## How it works

Every controller and service the app binds gets hooks: those listed in `@MeoCord({ controllers, services })`, everything
they depend on, what `@MeoCord({ providers })` supplies, the app's cooldown store and its `themeFor` class.
[Observers](guide:observers) get them too. Guards, interceptors and filters get none, unless the app also binds it:
listed in `services` or `providers`, or injected by a class that gets hooks.

## onReady

`onReady` runs once the client is ready. It receives the client and `{ primary }`, which says whether this
process should do one-off work: `true` for a bot in one process, and with
[process sharding](guide:sharding) only in the process running shard 0.

The hooks run one at a time, each class after the classes it injects. Classes with no dependency between them run in
declaration order: the app's cooldown store first, then the `providers`, the `services`, the `themeFor` class, the
`controllers` and the observers. Command registration runs alongside and never delays them. A hook still running after
10 seconds is named in a warning, and the hooks after it wait for it.

## onShutdown

`onShutdown` runs on SIGINT, SIGTERM or [`app.stop()`](#stopping-from-code), before the client is destroyed, in reverse
order, so a class stops before the classes it uses. The bot waits for the whole sequence up to `shutdownTimeout` in
[`meocord.config.ts`](guide:configuration), 10 seconds by default, then shuts down whether or not it finished.

- A second signal more than a second after the first exits at once. One sooner counts as the same request,
  since a terminal's Ctrl+C can arrive twice.
- If the bot never became ready, because the login failed, no `onShutdown` hook runs.
- A signal while the `onReady` hooks are still running shuts down only the classes the hooks had reached: those
  whose `onReady` finished, and those before them without one. No further `onReady` starts.

## Stopping from code

`await app.stop()` stops the bot without a signal, as an owner-only shutdown command, a graceful restart or an
integration test needs. It runs the `onShutdown` hooks under `shutdownTimeout` and closes the client. A bot in one
process keeps its process running.

- With [process sharding](guide:sharding#a-process-per-shard), it stops every shard, whichever process calls it. The
  manager's `stop()` keeps the manager running; a shard's ends that shard's process with the others.
- A client that fails to close, or a shard the manager has to kill, sets `process.exitCode` to 1, unless another code is
  set, as a signal's shutdown would.
- A stop while the bot logs in ends that login, so its `start()` rejects.
- Calls after the first wait for it. A stopped app doesn't start again; create a new one with `MeoCordFactory.create`.
- A signal while `stop()` runs waits for its hooks to finish rather than exiting at once.

## Failures

A hook that throws is logged, and the next one still runs. When a class's `onReady` failed, the classes that
depend on it still run theirs, with a warning naming the failed dependency.

## Testing

A hook is a method, so a unit test calls it as the bot would, with a client from `createMockClient`:

::example{file="services/reminder.scheduler.spec.ts" region="spec"}

A [testing module](guide:testing) runs them in the bot's order: `await module.init({ ready: true })` runs every
`onReady`, with a mock client and `{ primary: true }` unless `ready` names others, and `await module.close()`
runs the `onShutdown` hooks, in reverse, of everything the module constructed. Every hook runs even when one
throws; `init` or `close` then rejects with that error, or an `AggregateError` naming each hook that threw.

## Gotchas

- **One-off work runs on every shard.** With process sharding, check `primary` before work only one process
  should do, such as posting a daily summary.
- **A slow `onReady` holds up the rest.** Hooks run one at a time. Start long work without awaiting it, and
  stop it in `onShutdown`.
- **Work left running at shutdown.** A timer the class doesn't clear keeps running until the process exits.
  Clear it in `onShutdown`.

## Build it

Once the bot is online, its profile says how to reach it: "Listening to /feedback".

::example{file="tutorial/activity.service.ts" region="lifecycle-hooks"}

Add `ActivityService` to `services` in the app. `onReady` runs once the client is ready, so `client.user`
is there to set.

## Next steps

- [Gateway events](guide:gateway-events): handle what happens in Discord.
- [Sharding](guide:sharding): run the bot across processes.
- [Observers](guide:observers): export metrics and flush them at shutdown.
