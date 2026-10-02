---
id: sharding
title: Sharding
chapter: shipping
order: 4
summary: Split the bot's gateway connection into shards, in one process or a process each, and reach every shard.
learn:
  - Turn sharding on, in one process or a process per shard
  - Call a service's method in every shard
  - Keep cooldowns counted across processes
requires: [deployment, services, cooldowns]
api: [configuration/ShardingConfig, controllers/ShardContext, utilities/ShardedCooldownStore]
since: 4.1.0
---

Discord requires a bot in more than about 2,500 servers to split its gateway connection into shards, each carrying some
of the servers. MeoCord runs them for you: turn it on in `meocord.config.ts`, and the rest of the app stays as it is.

## When to use it

- **Discord asks for it:** past about 2,500 servers, a bot that doesn't shard can't log in.
- **One CPU core isn't enough:** a process per shard spreads the work over several.

Below that, leave `sharding` unset: a single connection is simpler, and nothing about the app changes when you turn it
on later.

## Example

::example{file="config/sharding.meocord.config.ts" region="config"}

`shards: 'auto'` asks Discord how many shards the bot needs, where a number sets it, and `mode: 'process'` runs each
in a process of its own. Start the bot as usual.

## How it works

By default, every shard runs in one process and one client: one set of services, `onReady` once, commands registered
once, and nothing else changes. Unset, `sharding` leaves `clientOptions.shards` as you set it.

## A process per shard

`mode: 'process'` runs each shard in a process of its own. Start the bot as usual, with `npx meocord start`,
`node dist/main.js`, Bun, pm2 or Docker, and the first process becomes a manager that:

- registers the commands once, then spawns the shards one after another from the built bundle, with the same runtime
  flags, such as Bun's `--no-install`;
- restarts a shard that exits, waiting 1 second, then 2, 4 and so on up to a minute, and from the start again once a
  shard has stayed up for five minutes;
- stops everything and exits 1 when a shard can't log in because the token is invalid or Discord refuses its intents,
  rather than restarting it forever, and says which privileged intents to enable;
- stops everything and exits 1 when a shard refuses the app, as it does for two services with one name or native addons
  built for another platform, since every shard would refuse it alike. It logs
  `Shard N cannot start; stopping every shard.` with the reason on a line of its own, and `meocord start --dev` isn't
  told the bot failed to log in;
- on SIGINT or SIGTERM, asks each shard to shut down through its `onShutdown` hooks, waits up to `shutdownTimeout` plus
  five seconds, and kills any shard still running, on Windows too. A second signal more than a second after the first
  kills them at once. [`app.stop()`](guide:lifecycle-hooks#stopping-from-code) does the same from any process,
  manager or shard.

Each shard process runs the whole application with its own container, and its lifecycle hooks run in it. `onReady`'s
`primary` is `true` only in the process running shard 0. Under `meocord start --dev`, every shard runs in one process,
so the watcher restarts a single one; `sharding.development: true` runs separate processes there too.

### State in memory

What a service keeps in memory is per process too, cooldowns included. Counted per shard, `'user'` and `'global'`
cooldowns allow more than they say, and the bot warns at startup. Bind `ShardedCooldownStore` to count them in the
manager instead: see [Where calls are counted](guide:cooldowns#where-calls-are-counted).

## Reaching every shard

Inject `ShardContext` from `meocord/core`, and `call` a service's method in every process:

::example{file="services/stats.service.ts" region="service"}

- **Results:** `call(Service, 'method', ...args)` resolves to one `{ shardIds, ok, value }` or
  `{ shardIds, ok, error }` per process: one per shard with process sharding, and one in all otherwise.
- **Which service:** each process resolves it from its own container, the class you pass in this process, and the
  class of the same name in another.
- **What crosses:** only JSON, arguments and results alike, in every mode: in one process and in a test too, a `Date`
  arrives as a string, a `Map` as `{}` and a function as `undefined`, and a value JSON can't write, such as a
  `BigInt`, gives an error result. With process sharding, the bot refuses to start when two controllers or services
  share a name.
- **Failures:** a process that throws, lacks the service or takes more than 10 seconds gives an error result, and the
  others still answer.
- **This process:** `ids`, `count` and `isPrimary` describe its shards.

`broadcastEval` is there too, but it turns its function into a string, which a minified bundle can break; prefer
`call`.

### Testing

The testing module runs as one process, so a `call` runs the method once, in the module, with its arguments and
result passed as JSON, as between processes:

::example{file="services/stats.service.spec.ts" region="spec"}

## Gotchas

- **A cooldown counted per process** lets a user through once per shard. Bind `ShardedCooldownStore`, or a shared
  store such as Redis.
- **Two classes with the same name** stop a process-sharded bot at startup, since `call` finds a service by name.
- **`broadcastEval` breaks under minification.** Use `call`, which sends only a name and JSON.

## Next steps

- [Security](guide:security): what keeps a bot in thousands of servers safe.
- [Cooldown stores](guide:recipes/cooldown-stores): count cooldowns in Redis, across processes and restarts.
- [`ShardContext`](api:controllers/ShardContext): every member, with its types.
