---
id: cooldowns
title: Cooldowns
section: Handling a call
order: 35
since: 4.1.0
---

`@Cooldown` limits how often a handler runs: at most `uses` calls within `seconds`, counted per user by
default. The window slides, so each use comes back `seconds` after it was spent. Stack several for layered
limits:

::example{file="controllers/slash/daily.slash.controller.ts" region="cooldown"}

Stacked cooldowns are counted in the order they read, a controller's first, and a call one of them blocks has
already spent those above it. With the short one first, as here, a call made a second after the last is
refused by the three-second cooldown before it reaches the per-minute one.

| Option    | Default  | What it does                                                                                                                            |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `seconds` | none     | The window's length.                                                                                                                    |
| `uses`    | `1`      | Calls allowed within the window.                                                                                                        |
| `per`     | `'user'` | Whose calls count together: `'user'`, `'guild'`, `'channel'` or `'global'`. Outside a server, `'guild'` and `'channel'` count per user. |
| `bypass`  | none     | `(context) => boolean`: exempts a call without counting it, one from an owner for instance.                                             |
| `by`      | none     | `(context, params) => string \| number \| undefined`: counts calls apart by a value of the call, within the scope `per` names.          |

A blocked call throws `CooldownError` from `meocord/common`, which the built-in fallback answers only to the
caller: "Slow down: try again in 12s." `cooldownMessage(retryAfterMs)` builds that text, and an exception
filter catching `CooldownError` can say it another way, or in the user's language.

The cooldown is the last stage before the handler: guards, validation and pipes have let the call through,
so a denied call or bad input spends nothing. It applies to interaction and message handlers. On a
controller, it applies to each of those handlers separately.

Cooldowns are counted under the controller's class name, so the bot refuses to start when two classes share
a name and either has a cooldown; rename one of them.

::example{file="controllers/slash/daily.slash.controller.spec.ts" region="spec"}

## Counting per resource

`per` decides whose calls count together; `by` splits that count by a value of the call, such as the account a
button acts on. A user with three game accounts can then check each of them in once an hour:

::example{file="controllers/button/check-in.button.controller.ts" region="by"}

`by` receives the call's `ExecutionContext` and the handler's params as the handler receives them: a component's
customId params, a command's options, a modal's fields, after validation and pipes. For a piped object, return a
stable id from it, such as `({ account }) => account.uid`.

- Declare the params `by` reads, or pass them as the type argument, `@Cooldown<{ uid: string }>({ … })`. A key
  the handler does not receive, or receives as another type, fails to compile; undeclared, they are
  `Record<string, unknown>`.
- With `per: 'global'`, the limit is per resource across every user.
- Returning `undefined` counts the call as though there were no `by`. An error `by` throws goes to the
  [exception filters](/docs/4.1/exception-filters), and no cooldown on the handler counts the call.
- The value becomes part of the key the store counts under, encoded so a value holding `:` cannot count under
  another's key. `inspectHandler(...).cooldowns` reports `by: true` for a cooldown that has one.

The guard runs first, so a stranger pressing someone else's button is refused without spending the owner's
check-in:

::example{file="controllers/button/check-in.button.controller.spec.ts" region="spec"}

## Where calls are counted

By default, in this process's memory: one count per bot, which drops keys whose calls have all expired. With
[process sharding](/docs/4.1/sharding#a-process-per-shard), each shard counts on its own, so `'user'` and
`'global'` cooldowns allow more than they say, and the bot warns at startup unless it binds a shared store.
`'guild'` and `'channel'` stay exact, since a server lives on one shard.

| Store                               | Counts                                            | Survives a restart               | Across hosts         |
| ----------------------------------- | ------------------------------------------------- | -------------------------------- | -------------------- |
| `MemoryCooldownStore` (the default) | In this process; per shard with process sharding  | No                               | No                   |
| `ShardedCooldownStore`              | In the shard manager, for every shard on the host | A shard's restart, not the bot's | No                   |
| `RedisCooldownStore`                | On the Redis server                               | Yes                              | Yes                  |
| Your own `CooldownStore`            | Where it keeps them                               | As its database does             | As its database does |

To keep counts across restarts, or share them between shards and processes, bind a shared store with
`@MeoCord({ cooldownStore })`. In tests, each testing module counts in a fresh in-memory store; provide
`{ provide: CooldownStore, useValue }` to use another.

### Process sharding on one host

`ShardedCooldownStore` from `meocord/common` needs no database: each shard asks the shard manager, which counts
every shard's calls in its memory over the IPC the shards already use, so `'user'` and `'global'` cooldowns
are exact across them.

::example{file="recipes/cooldown-stores/app-sharded.ts" region="app"}

- The manager's counts last while it runs: a shard that restarts keeps them, but they start again when the
  whole bot restarts, as the default store's do.
- If the manager does not answer within a second, the shard counts the call itself and logs a warning, once.
- Without process sharding, it counts in the one process, which is exact there too.

### Redis

`RedisCooldownStore` from `meocord/common` counts each key in a sorted set. One Lua script trims, counts and
adds to it, timed by the server's `TIME` so every process counts by one clock, and every key is set to expire.
MeoCord depends on no Redis client: give `RedisCooldownStore.using` a function that runs a script with the one
you have. With node-redis:

::example{file="recipes/cooldown-stores/redis.ts" region="store"}

`using` returns a class, which the app binds like any other store:

::example{file="recipes/cooldown-stores/app-redis.ts" region="app"}

- With ioredis, run the script as `(script, keys, args) => redis.eval(script, keys.length, ...keys, ...args)`.
- `evalsha` is optional. With it, the script is sent by its SHA1, and in full only when the server answers
  `NOSCRIPT`; without it, every call sends the whole script.
- Keys start with `meocord:cooldown:`. Pass `{ prefix }` for your own, to keep two bots on one server apart.
- The same script runs on Redis 5 and later, Valkey, KeyDB, Dragonfly and Upstash, which runs `EVAL`. Garnet
  runs Lua only in part, so [check it](#checking-a-store) before relying on it.

### Any other database

Extend `CooldownStore`. It is resolved like a [service](/docs/4.1/services), so it can inject its client, and
its `consume` must check and record a call in one step, so two calls at the limit cannot both pass.
[A cooldown store](/docs/4.1/recipe-cooldown-stores) builds one for PostgreSQL, SQLite and MongoDB.

## Checking a store

A shared store is easy to get subtly wrong. `testCooldownStore` from `meocord/testing` runs the behaviour
`MemoryCooldownStore` defines against yours, under Vitest, Jest or any runner with `describe`, `it` and
`expect`:

::example{file="recipes/cooldown-stores/sharded.spec.ts" region="spec"}

It checks that:

- a key allows `uses` calls within the window, and the window slides rather than resetting in buckets;
- `retryAfterMs` counts from the oldest call still in the window, so "try again in 12s" means the same
  whatever the store;
- each key counts on its own, and calls in the same millisecond stay distinct;
- of several concurrent calls at the limit, exactly one passes.

It uses real time with short windows, so it takes a few seconds. Each case asks the factory for a store and
counts under keys of its own, so it can run against a database that outlives the test. What it cannot see is
whether every key expires: a store should give each one an expiry, or clear keys whose calls have all left
their window.
