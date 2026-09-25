---
id: sharding
title: Sharding
section: Shipping
order: 64
since: 4.1.0
---

Discord requires a bot in more than about 2,500 servers to split its gateway connection into shards. Turn it
on with `sharding` in `meocord.config.ts`, with `shards: 'auto'` or a number:

::example{file="config/sharding.meocord.config.ts" region="config"}

By default, every shard runs in one process and one client: one set of services, `onReady` once, commands
registered once, and nothing else changes. Unset, `sharding` leaves `clientOptions.shards` as you set it.

## A process per shard

For a bot that needs more than one CPU core, `mode: 'process'` runs each shard in a process of its own.
Start the bot as usual, with `meocord start`, `node dist/main.js`, bun, pm2 or Docker, and the first process
becomes a manager that:

- registers the commands once, then spawns the shards one after another from the built bundle, with the same
  runtime flags, such as bun's `--no-install`;
- restarts a shard that exits, waiting 1 second, then 2, 4 and so on up to a minute, and from the start
  again once a shard has stayed up for five minutes;
- stops everything and exits 1 when a shard cannot log in because the token is invalid or Discord refuses
  its intents, rather than restarting it forever, and says which privileged intents to enable;
- on SIGINT or SIGTERM, asks each shard to shut down through its `onShutdown` hooks, waits up to
  `shutdownTimeout` plus five seconds, and kills any shard still running, on Windows too. A second signal
  more than a second after the first kills them at once.

Each shard process runs the whole application with its own container, and its lifecycle hooks run in it;
`onReady`'s `primary` is `true` only in the process running shard 0. Under `meocord start --dev`, every shard
runs in one process so the watcher restarts a single one; `sharding.development: true` runs separate
processes there too.

## Reaching every shard

Inject `ShardContext` from `meocord/core`, and `call` a service's method in every process:

::example{file="services/stats.service.ts" region="service"}

- `call(Service, 'method', ...args)` resolves to one `{ shardIds, ok, value }` or `{ shardIds, ok, error }`
  per process: one per shard with process sharding, and one in all otherwise.
- Each process resolves the service from its own container: the class you pass in this process, and the
  class of the same name in another. Only JSON crosses between processes, arguments and results alike, so
  with process sharding the bot refuses to start when two controllers or services share a name.
- A process that throws, lacks the service or takes more than 10 seconds gives an error result, and the
  others still answer.
- `ids`, `count` and `isPrimary` describe the shards of this process.
- `broadcastEval` is there too, but it turns its function into a string, which a minified bundle can break;
  prefer `call`.

The testing module runs as one process, so a `call` runs the method once, in the module:

::example{file="services/stats.service.spec.ts" region="spec"}
