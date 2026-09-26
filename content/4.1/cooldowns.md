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

Stacked cooldowns are counted together, a controller's first: a call is counted against all of them only if
all allow it, so a call one refuses spends none of the others, and it waits the longest wait among those that
refuse it. Here, a call made a second after the last is refused by the three-second cooldown and keeps its
per-minute uses. Every store MeoCord ships counts this way; a store of your own counts them one after another
unless it [overrides `consumeMany`](#any-other-database).

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
- A handler's stacked cooldowns go to the manager in one message. A manager that does not answer in time is a
  [store failure](#when-the-store-fails).
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
- One script counts all of a handler's stacked cooldowns, so a call costs one round trip however many it has.
- On Redis Cluster, a handler's keys usually sit in different slots, which one script cannot reach. The store
  then counts each key with a script of its own, in order, so a call one cooldown refuses has counted against
  those before it. `{ hashTag: 'handler' }` keeps each handler's keys in one slot, and its cooldowns one step;
  every call to that handler then lands on that slot.
- Keys start with `meocord:cooldown:`. Pass `{ prefix }` for your own, to keep two bots on one server apart.
- The same script runs on Redis 5 and later, Valkey, KeyDB, Dragonfly and Upstash, which runs `EVAL`. Garnet
  runs Lua only in part, so [check it](#checking-a-store) before relying on it.

### Any other database

Extend `CooldownStore`. It is resolved like a [service](/docs/4.1/services), so it can inject its client, and
its `consume` must check and record a call in one step, so two calls at the limit cannot both pass.

`@Cooldown` calls `consumeMany(entries)` once per call, with every stacked cooldown. Its default calls `consume`
for each in order and stops at the first refusal. Override it to check them all and record the call against
all only if all allow it, in one round trip, as the built-in stores do; it is worth it for any store behind a
network.
[A cooldown store](/docs/4.1/recipe-cooldown-stores) builds one for PostgreSQL, SQLite and MongoDB.

## When the store fails

A shared store can be down, restarting or cut off. When it throws, rejects or does not answer within
`cooldownStoreTimeoutMs`, a second by default, `cooldownStoreFailure` decides what the call gets:

::example{file="recipes/cooldown-stores/app-store-failure.ts" region="app"}

- **`'deny'`**, the default, refuses the call with `CooldownStoreError` from `meocord/common`, since a cooldown
  that cannot be checked is not known to allow it. The built-in fallback answers only the caller: "Cooldowns
  can't be checked right now: try again shortly." An exception filter catching `CooldownStoreError` can say it
  another way, or in the user's language. [Observers](/docs/4.1/observers) see `outcome: 'error'` with that
  error.
- **`'allow'`** runs the call without counting it, keeping the bot available while the store is down.

Either way, the failure is logged once per outage, with its cause, and again when the store answers, with how
many calls failed. MeoCord never counts a call itself or asks twice, so a store that answers after the timeout
records the call once, in the store; under `'deny'`, that call was refused and still spent a use there.

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
- of several concurrent calls at the limit, exactly one passes;
- a batch is counted against all its cooldowns at once, and a refusal names the longest wait;
- for a store that overrides `consumeMany`, a batch one cooldown refuses records nothing, and of several
  concurrent batches at the limit, exactly one passes.

It uses real time with short windows, so it takes a few seconds. Each case asks the factory for a store and
counts under keys of its own, so it can run against a database that outlives the test. What it cannot see is
whether every key expires: a store should give each one an expiry, or clear keys whose calls have all left
their window.
