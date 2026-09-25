---
id: recipe-database
title: A database
section: Recipes
order: 71
since: 4.1.0
---

A bot that saves notes for each user in PostgreSQL. The database lives in one service, which connects as the
bot starts and closes as it stops; handlers inject it, and tests replace it. The same shape works for any
client library.

## The store

The store is a [service](/docs/4.1/services): one instance shared by every call, so one connection pool.
Its [lifecycle hooks](/docs/4.1/lifecycle-hooks) prepare the table once the bot is ready and close the pool
before it stops:

::example{file="recipes/database/notes.store.ts" region="store"}

It reads `DATABASE_URL` from the environment, which `meocord.config.ts` loads; see
[Environment variables](/docs/4.1/configuration#environment-variables).

## The handlers

A query can outlast the three seconds Discord gives for a first answer, so both commands use
[`@Defer`](/docs/4.1/defer), privately:

::example{file="recipes/database/notes.controller.ts" region="controller"}

## Testing it

The testing module takes the store as a value, so the controller's tests run against an in-memory store
with no database:

::example{file="recipes/database/notes.controller.spec.ts" region="spec"}

## Going further

- **Other clients.** An ORM or another driver goes in the same place: construct it in the store, connect or
  migrate in `onReady`, close in `onShutdown`.
- **Native drivers.** A driver with a compiled binary, such as a SQLite binding, works with
  [self-contained builds](/docs/4.1/self-contained-builds), which pack it into `dist`.
- **Sharding.** With a process per shard, each process has its own store and pool; size the pool for the
  number of processes. See [Sharding](/docs/4.1/sharding).
- **Migrations** belong in a deploy step before the bot starts, rather than in `onReady`, once the schema
  changes over time.
