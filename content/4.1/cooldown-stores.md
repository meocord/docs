---
id: cooldown-stores
title: Cooldown stores
chapter: appendix
group: recipes
order: 8
summary: Keep cooldown counts in Redis, across shards, or in PostgreSQL, SQLite or MongoDB, and check a store of your own.
requires: [cooldowns, services]
api:
  [
    utilities/CooldownStore,
    utilities/RedisCooldownStore,
    utilities/ShardedCooldownStore,
    utilities/MemoryCooldownStore,
    testing/testCooldownStore,
  ]
since: 4.1.0
formerly: [recipe-cooldown-stores]
---

By default, [`@Cooldown`](guide:cooldowns) counts calls in the bot's memory: they're gone on a restart, and with
process sharding each shard counts on its own. A store keeps them elsewhere. Pick one by where the bot runs:

| The bot runs                               | Store                                              |
| ------------------------------------------ | -------------------------------------------------- |
| In one process, restarts are fine          | `MemoryCooldownStore`, the default                 |
| As process shards on one host              | `ShardedCooldownStore`, with no database           |
| On several hosts, or must survive restarts | `RedisCooldownStore`, or a store for your database |

## The code

`RedisCooldownStore` depends on no Redis client. Give `RedisCooldownStore.using` a function that runs a script with
the one you have. With node-redis:

::example{file="recipes/cooldown-stores/redis.ts" region="store"}

`using` returns a class, which the app binds as its store:

::example{file="recipes/cooldown-stores/app-redis.ts" region="app"}

## How it works

A store is a [service](guide:services) that extends `CooldownStore`. `@Cooldown` calls its `consumeMany(entries)`
once per call, with every stacked cooldown. Three things make a store correct:

- **One step.** The check and the record happen together, so two calls at the limit can't both pass.
- **One clock.** Processes on several hosts count by the database's clock, not each host's own.
- **Every key expires.** A key whose calls have all left their window is removed, so the store doesn't grow
  forever.

`RedisCooldownStore` counts each key in a sorted set. One Lua script trims, counts and adds to every key of the
call, timed by the server's `TIME`, and sets each key to expire. So a call costs one round trip however many
cooldowns it has, and a call one of them refuses counts against none.

- **`evalsha`** is optional. With it, the script is sent by its SHA1, and in full only when the server answers
  `NOSCRIPT`. Without it, every call sends the whole script.
- **Keys** start with `meocord:cooldown:`. Pass `{ prefix }` for your own, to keep two bots on one server apart.
- **Servers:** the same script runs on Redis 5 and later, Valkey, KeyDB, Dragonfly and Upstash. Garnet runs Lua
  only in part, so [check it](#checking-a-store) before relying on it.

## Variations

### ioredis

Run the script as `(script, keys, args) => redis.eval(script, keys.length, ...keys, ...args)`.

### Redis Cluster

A handler's keys usually sit in different slots, which one script can't reach. The store then counts each key with a
script of its own, in order, and gives back the uses counted before a refusal, so a refused call counts against none
unless a give-back fails. Pass `{ hashTag: 'handler' }` to keep each handler's keys in one slot, and its cooldowns in
one step. Every call to that handler then lands on that slot.

### Process sharding on one host

`ShardedCooldownStore` needs no database. Each shard asks the shard manager, which counts every shard's calls in its
memory, over the IPC the shards already use:

::example{file="recipes/cooldown-stores/app-sharded.ts" region="app"}

The counts last while the manager runs: a shard that restarts keeps them, but they start again when the whole bot
restarts. A manager that doesn't answer in time is a [store failure](guide:cooldowns#when-the-store-fails). Without
process sharding, it counts in the one process.

### PostgreSQL

A row per call:

::example{file="recipes/cooldown-stores/postgres.store.ts" region="schema"}

The store counts a key's calls in a transaction that first takes an advisory lock on the key, so even its first
call, which has no row yet to lock, runs one at a time. `clock_timestamp()` times each row by the database's clock:

::example{file="recipes/cooldown-stores/postgres.store.ts" region="store"}

It injects the pool from the [database recipe](guide:recipes/database):

::example{file="recipes/cooldown-stores/app-postgres.ts" region="app"}

A key's rows go when it's next used. Clear the rest from a [scheduled task](guide:recipes/scheduled), with
`DELETE FROM cooldown_calls WHERE at < now() - interval '1 day'` or your longest window.

### SQLite

`node:sqlite` is built into Node 22.13 and later, and Bun. The same rows:

::example{file="recipes/cooldown-stores/sqlite.store.ts" region="schema"}

The store counts in an `IMMEDIATE` transaction, which takes the write lock before it reads, so two processes on one
file can't both take the last use:

::example{file="recipes/cooldown-stores/sqlite.store.ts" region="store"}

`busy_timeout` makes a call wait while another process holds the lock, rather than fail. `node:sqlite` is
synchronous, so that wait blocks the process. SQLite suits processes on one host, which is why `Date.now()` serves
as its clock:

::example{file="recipes/cooldown-stores/sqlite.store.ts" region="provider"}

### MongoDB

One document per key. A single `findOneAndUpdate` with an update pipeline trims the key's calls, counts them and
appends this one, timed by the server's `$$NOW`. Each call carries an id of its own, so the store can tell whether
the write recorded it:

::example{file="recipes/cooldown-stores/mongo.store.ts" region="store"}

A TTL index removes a key once its window has passed:

::example{file="recipes/cooldown-stores/mongo.store.ts" region="provider"}

### A store of your own

Extend `CooldownStore` and implement `consume(key, { uses, windowMs })` in one step. The default `consumeMany`
calls `consume` for each cooldown in order and stops at the first refusal, so a call one refuses has counted against
those before it. Override `consumeMany` to check them all and record the call only if all allow it, in one round
trip, as the built-in stores do. It's worth it for any store behind a network.

Override `peekMany(entries)` too, to check the entries and record nothing. MeoCord calls it before a message command
fetches the members, users, roles or channels it names, so a caller on cooldown costs no request. The default allows
every call, so a store without its own `peekMany` refuses only at `consumeMany`, after the fetch.

A store that connects can do it in its own [lifecycle hooks](guide:lifecycle-hooks). Its `onReady` runs before the
services', and a call that comes meanwhile waits for it, up to `cooldownStoreTimeoutMs`; one that would wait longer
meets the [`cooldownStoreFailure`](guide:cooldowns#when-the-store-fails) policy. Its `onShutdown` runs after the
services', once the calls under way have finished, along with every store operation they started, so the store closes
after its last write. A service that injects `CooldownStore` gets the app's store, whose hooks still run once.

### Giving back a refused call's use

When a store answers after `cooldownStoreTimeoutMs`, `@Cooldown` has already refused the call under `'deny'`. If the
late answer recorded the call, the caller would lose a use for a call that never ran, so `@Cooldown` calls the
verdict's `release()` to undo it. The built-in stores give `release`. A store of your own can add it to the verdict
its `consumeMany` returns:

::example{file="recipes/cooldown-stores/releasing.store.ts" region="store"}

A store without `release` keeps such a call counted. Under `'allow'` the call ran uncounted, so the late count stays.
`testCooldownStore` checks a store's `release` when it gives one. A release still under way when the bot stops
finishes before the store's `onShutdown` runs, so a store can close its connection there.

### Telling one wait from the next

A refusal can also give `retryTimestamp`: when the next call is allowed, as a Unix timestamp in milliseconds on the
store's own clock, the same for every refusal in one wait. `messages.dmOnCooldown` tells one wait from the next by
it, so a retry whose answer arrives late, or from another shard sharing the store, isn't told about the same wait
again. The built-in stores give it. A store without it is told apart by `retryAfterMs` and the bot's clock instead.

### Checking a store

`testCooldownStore` from `meocord/testing` runs the behaviour `MemoryCooldownStore` defines against yours, under
Vitest, Jest or any runner with `describe`, `it` and `expect`:

::example{file="recipes/cooldown-stores/sharded.spec.ts" region="spec"}

It checks that:

- a key allows `uses` calls within the window, and the window slides;
- `retryAfterMs` counts from the oldest call still in the window, and every refusal in one wait gives the same
  `retryTimestamp`, when the store gives one;
- each key counts on its own, and calls in the same millisecond stay distinct;
- of several concurrent calls at the limit, exactly one passes;
- a batch is counted against all its cooldowns at once, and a refusal names the longest wait;
- a refused batch records nothing, or, with the default `consumeMany`, counts the cooldowns before the one that
  refuses, as one call to `consume` after another does;
- of several concurrent batches at the limit, exactly one passes;
- a peek records nothing, answers a refusal with the wait `consume` gives, and names a batch's longest wait, or,
  with the default `peekMany`, allows every call.

It uses real time with short windows, so it takes a few seconds. Each case counts under keys of its own, so it can
run against a database that outlives the test. It can't see whether every key expires; check that yourself.

Every `windowMs` a store gets is a whole number of milliseconds, from 1 to 4320000000000000: `@Cooldown` rounds
`seconds` to the millisecond and refuses one outside `0.001` to `4320000000000`. A database that takes only whole
milliseconds, as Redis's `PEXPIRE` does, can store it as it is.

## Next steps

- [Cooldowns](guide:cooldowns): the limits a store counts, and what a call gets when the store fails.
- [A database](guide:recipes/database): the pool the PostgreSQL store injects.
- [Sharding](guide:sharding): when process sharding needs a shared store.
