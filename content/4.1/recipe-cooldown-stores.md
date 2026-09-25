---
id: recipe-cooldown-stores
title: A cooldown store
section: Recipes
order: 77
since: 4.1.0
---

Cooldowns kept in a database the bot already has, so they outlive a restart and are shared by every shard and
process that uses it: a store for PostgreSQL, one for SQLite and one for MongoDB. For Redis, or for process
sharding on one host, MeoCord has stores of its own; see
[Where calls are counted](/docs/4.1/cooldowns#where-calls-are-counted).

Each store below passes [`testCooldownStore`](/docs/4.1/cooldowns#checking-a-store) against a real server:
PostgreSQL 18, SQLite through `node:sqlite`, and MongoDB 8.2.

## What a store does

A store is a [service](/docs/4.1/services) that extends `CooldownStore` and injects its client by a token, as
the [database recipe](/docs/4.1/recipe-database) does. Its one method, `consume(key, { uses, windowMs })`,
records a call if fewer than `uses` were made within the last `windowMs`, and otherwise answers how long until
one may be. Three things make it correct:

- **One step.** The check and the record happen together, in a transaction holding a lock on the key or in a
  single atomic update, so two calls at the limit cannot both pass.
- **One clock.** Processes on several hosts count by the database's clock, not by each host's own.
- **Every key expires.** A key whose calls have all left their window is removed, so the store does not grow
  forever.

## PostgreSQL

A row per call:

::example{file="recipes/cooldown-stores/postgres.store.ts" region="schema"}

The store counts a key's calls in a transaction that first takes an advisory lock on the key, so the key's
calls run one at a time, even its first, which has no row yet to lock. `clock_timestamp()` times every row by
the database's clock:

::example{file="recipes/cooldown-stores/postgres.store.ts" region="store"}

It injects the pool from the [database recipe](/docs/4.1/recipe-database), and the app binds it:

::example{file="recipes/cooldown-stores/app-postgres.ts" region="app"}

A key's rows go when it is next used. Clear the rest from time to time, with
`DELETE FROM cooldown_calls WHERE at < now() - interval '1 day'` or your longest window, from a
[scheduled task](/docs/4.1/recipe-scheduled).

## SQLite

`node:sqlite` is built into Node 22.13 and later, and Bun; the same code runs under both. The same rows:

::example{file="recipes/cooldown-stores/sqlite.store.ts" region="schema"}

The store counts in an `IMMEDIATE` transaction, which takes the write lock before it reads, so two processes on
one database file cannot both take the last use:

::example{file="recipes/cooldown-stores/sqlite.store.ts" region="store"}

The provider opens the file `SQLITE_PATH` names and makes the table. `busy_timeout` makes a call wait while
another process holds the lock, rather than fail; `node:sqlite` is synchronous, so that wait blocks the
process. SQLite suits a bot whose processes share one host, which is also why `Date.now()` serves as its
clock; for several hosts, use PostgreSQL.

::example{file="recipes/cooldown-stores/sqlite.store.ts" region="provider"}

Its tests run against an in-memory database, with nothing to start:

::example{file="recipes/cooldown-stores/sqlite.store.spec.ts" region="spec"}

## MongoDB

One document per key. A single `findOneAndUpdate` with an update pipeline trims the key's calls, counts them
and appends this one, so the check and the record are one atomic write, timed by the server's `$$NOW`:

::example{file="recipes/cooldown-stores/mongo.store.ts" region="store"}

Each call carries an id of its own, so the store can tell whether the write recorded it, even beside another
call in the same millisecond. The provider connects, and adds a TTL index that removes a key once its window
has passed:

::example{file="recipes/cooldown-stores/mongo.store.ts" region="provider"}

## Going further

- **Binding.** Each store binds as the PostgreSQL one does: its provider in `providers`, and the class as
  `cooldownStore`.
- **Checking your own.** Run `testCooldownStore` against a store for another database before relying on it.
  It counts under keys of its own, so it can run against a database that outlives the test.
- **Migrations.** Create the tables and indexes in a deploy step once the schema changes over time, as the
  [database recipe](/docs/4.1/recipe-database#going-further) suggests.
