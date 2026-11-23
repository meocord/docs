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
  - Hold each call until the hooks it needs have run, with `waitForReady`
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
listed in `services` or `providers`, or injected by a class that gets hooks. A service that only a guard, interceptor,
filter, pipe or the presenter injects gets hooks too: it is made as the bot comes online, once, like any other service.
A class that injects the call's `ExecutionContext` is made for each call instead, and has no hooks. One instance that
two tokens reach, such as a factory that returns a service's instance or one object given as `useValue` under two
tokens, runs each hook once.

## onReady

`onReady` runs once the client is ready. It receives the client and `{ primary }`, which says whether this
process should do one-off work: `true` for a bot in one process, and with
[process sharding](guide:sharding) only in the process running shard 0.

The hooks run one at a time, each class after the classes it injects. Classes with no dependency between them run in
declaration order: the app's cooldown store first, then the `providers`, the `services`, the `themeFor` class, the
`controllers` and the observers. Command registration runs alongside and never delays them. A hook still running after
10 seconds is named in a warning, with how long it has run and how many hooks wait behind it, and the hooks after it
wait for it. Start long work without awaiting it in `onReady`, and stop it in `onShutdown`. Setting `warnSlow: false`
in `@MeoCord` silences the warning, with MeoCord's other slow warnings.

### Waiting for the hooks

By default, commands and events don't wait for these hooks. Once the bot is online, a call can reach a class whose
`onReady` hasn't run or hasn't finished, so a handler can't rely on a cache an `onReady` warms or a connection it opens.
Only the cooldown store's `onReady` is waited for. Make what a call needs in an async
[factory provider](guide:services#providers), which runs before login, or set `@MeoCord({ waitForReady: true })`:

::example{file="services/prices/price-cache.service.ts" region="cache"}

::example{file="app-wait-for-ready.ts" region="app"}

::example{file="services/prices/price.slash.controller.ts" region="controller"}

With it, each call waits for the `onReady` hooks of the classes it uses: its controller, the guards, interceptors,
filters and pipes that run for it, the presenter, the `themeFor` class, and what each of them injects. The hooks still
run one at a time, so a call also waits for a slower hook ordered before its own. A hook that throws counts as settled.

The wait comes after `@Defer`'s acknowledgement and before the guards, so a deferred command is acknowledged at once and
waits as long as its hooks run. A message, a reaction and an event wait as long, too. An interaction without `@Defer`
can't: Discord gives it 3 seconds. It waits until 2 seconds after it was created, an autocomplete 1 second, then runs,
with a warning naming the hook and the handler to add `@Defer` to.

A stop decides every call still waiting before the `onShutdown` hooks: a call whose hooks have settled runs, and any
other is dropped. A dropped call runs nothing and sends nothing more to Discord, its observers see the outcome `'error'`
with "The bot stopped before this call started.", and the bot names it in a warning. One exception: when `@Defer` had
already sent the deferred reply of a command, or of a modal sent from one, MeoCord deletes it, so the user isn't left on
"thinking…", and refuses any answer asked for after that. The deferred update of a component, or of a modal a component
opened, shows nothing and is left as it is.

::example{file="services/prices/price.slash.controller.spec.ts" region="spec"}

A [testing module](guide:testing) built from the app waits too: a call made while `init({ ready: true })` runs the
hooks waits for them.

## onShutdown

`onShutdown` runs on SIGINT, SIGTERM or [`app.stop()`](#stopping-from-code), before the client is destroyed, in reverse
order, so a class stops before the classes it uses. The bot waits for the whole sequence up to `shutdownTimeout` in
[`meocord.config.ts`](guide:configuration), 10 seconds by default, then shuts down whether or not it finished.

Shutdown first stops taking events and waits for the calls under way, `@On` and `@Once` handlers included, then runs the
`onShutdown` hooks. A call that awaits `app.stop()`, as an owner-only shutdown command does, isn't waited for.
`shutdownTimeout` bounds the whole shutdown: the calls are waited for no longer than the timeout less a reserve kept for
the hooks, a quarter of it, at least 1 second and never more than half. A call still running then is named in a warning.
While dropped calls' deferred replies are being deleted, all at once, the hooks may start up to 1 second later, taking
never more than half of their reserve. Deletions that fail by then are named in one warning; one still running goes on
without the hooks waiting for it, and is named in a warning of its own if it fails.

An `onShutdown` hook may stop the app itself, as cleanup code it shares with an owner-only shutdown command does. A
`stop()` called while a hook of the shutdown under way runs, by the hook or by work it started, awaited or not, resolves
for it at once, and the hooks after it run in order. The stop it asks for still runs as any stop does: in a shard, it
asks the manager to stop every shard. One called after the hook has returned, by work it left running, waits for the
whole shutdown, as any caller does. A hook that stops another app waits for that app's whole stop.

- A second signal more than a second after the first exits at once. One sooner counts as the same request,
  since a terminal's Ctrl+C can arrive twice.
- A signal while the bot starts exits 0, as one once it is online does: the process exits with the code set when the
  shutdown began, so a code `main.ts` sets as `start()` rejects for the stop doesn't count. It still exits 1 when a
  client fails to close, or when a provider's factory fails while the shutdown waits for it.
- A signal's shutdown destroys the client and exits whatever fails in it: an `onShutdown` hook that throws is logged
  and changes no exit code, and a failure of the stop itself exits 1.
- A stop while the bot starts, before it is online, shuts down what the startup made: each class and provided value
  whose `onReady`, and that of everything it depends on, has finished or doesn't exist. A provided pool with no
  `onReady` is closed; a class whose `onReady` never ran isn't shut down, nor is anything that depends on it. For a bot
  in one process, `start()` then rejects with "The bot was stopped before it came online." once those hooks are done,
  or `shutdownTimeout` has ended the wait for them, and the stop resolves after it, so code that awaits `start()` finds
  what the start made shut down.
- A provider's factory the stop has waited `shutdownTimeout` for is left behind: the stop resolves without it, with a
  warning naming the factory, and `start()` rejects only once the factory settles. The value it returns then is shut
  down as it arrives, by its own `onShutdown` within `shutdownTimeout`, unless it has an `onReady`, which never ran;
  `start()` rejects after that. What the value injects is shut down already, so its `onShutdown` may find that closed.
- A start that fails, because a provider's factory or the login failed, shuts down what it made by the same rule, so
  the process can end with its exit code. A value given with `useValue` is left open: a retry of `start()` after the
  failed start makes the rest again, and once the bot stops, by `app.stop()`, a Ctrl+C or a SIGTERM, the value is shut
  down by the same rule, which leaves out one with an `onReady` a failed start never ran. A stop while a failed start
  shuts down waits for that shutdown, all within one `shutdownTimeout`.
- A stop while the `onReady` hooks are running, by a signal or `app.stop()`, waits for the `onReady` in progress, then
  shuts its class down with the others; no further `onReady` starts. One still running once only the hooks' share of
  `shutdownTimeout` is left is named in a warning, and its class isn't shut down.
- [`themeFor`](guide:theming) lookups still in flight end with the shutdown: a call waiting on one goes on in its
  handler's theme, and what the lookup gives later is dropped.

## Stopping from code

`await app.stop()` stops the bot without a signal, as an owner-only shutdown command, a graceful restart or an
integration test needs. It runs the `onShutdown` hooks under `shutdownTimeout` and closes the client. A bot in one
process keeps its process running. A `stop()` while the bot is starting waits for the provider factories in progress, at
most `shutdownTimeout`, and nothing more is made after it; [onShutdown](#onshutdown) says what it shuts down and when
`start()` rejects.

- With [process sharding](guide:sharding#a-process-per-shard), it stops every shard, whichever process calls it. The
  manager's `stop()` keeps the manager running; a shard's ends that shard's process with the others. A manager's
  `stop()` while its `start()` registers the commands or asks Discord for the shard count ends the start there: a
  registration already sending the commands finishes, nothing more asks Discord and no shard is spawned, and `start()`
  resolves.
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
throws; `init` or `close` then rejects with that error, or an `AggregateError` naming each hook that threw. A
`close()` that an `onShutdown` hook calls resolves for it at once, as `stop()` does in the bot. A `close()` while
`init()` makes the providers ends it as a stop ends a start: see [Testing](guide:testing#lifecycle-hooks-in-a-test).

## Gotchas

- **One-off work runs on every shard.** With process sharding, check `primary` before work only one process
  should do, such as posting a daily summary.
- **A slow `onReady` holds up the rest.** Hooks run one at a time. Start long work without awaiting it, and
  stop it in `onShutdown`.
- **A handler can run before `onReady` finishes.** Set `waitForReady: true` to hold its calls, and give a command
  `@Defer` so it can wait longer than 2 seconds.
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
