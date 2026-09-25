---
id: recipe-database
title: A database
section: Recipes
order: 71
since: 4.1.0
---

A bot that saves notes for each user in PostgreSQL. The connection pool is a
[provider](/docs/4.1/services#providers): made once, before the bot logs in, and injected by a token into
the stores that query it. Handlers inject the stores, and tests replace either one. The same shape works for
any client library.

## The pool

`createToken` makes a token typed with what it provides, and an async factory provides the pool under it.
MeoCord awaits the factory before login, so a database that refuses the connection stops the bot with the
reason, rather than failing on the first command:

::example{file="recipes/database/database.ts" region="provider"}

It reads `DATABASE_URL` from the environment, which `meocord.config.ts` loads; see
[Environment variables](/docs/4.1/configuration#environment-variables). The pool's `onShutdown` closes it as
the bot stops, after every class that injects it has stopped.

## The store

The store is a [service](/docs/4.1/services) that injects the pool with `@Inject(DATABASE)`. It holds the
queries and nothing else; every value reaches the database as a parameter:

::example{file="recipes/database/notes.store.ts" region="store"}

The app lists the provider. The store needs no listing, because the controller injects it:

::example{file="recipes/database/app.ts" region="app"}

## The handlers

A query can outlast the three seconds Discord gives for a first answer, so both commands use
[`@Defer`](/docs/4.1/defer), privately:

::example{file="recipes/database/notes.controller.ts" region="controller"}

## Testing it

The testing module takes the store as a value, so the controller's tests run against an in-memory store
with no database:

::example{file="recipes/database/notes.controller.spec.ts" region="spec"}

The store's own tests provide a stand-in pool under the same token, so its queries run against a mock:

::example{file="recipes/database/notes.store.spec.ts" region="spec"}

## Going further

- **Other clients.** An ORM or another driver goes in the same place: construct and connect it in the
  factory, and close it in the provided value's `onShutdown`.
- **Several stores.** Each store injects `DATABASE`, and all of them share the one pool.
- **Native drivers.** A driver with a compiled binary, such as a SQLite binding, works with
  [self-contained builds](/docs/4.1/self-contained-builds), which pack it into `dist`.
- **Sharding.** With a process per shard, each process has its own store and pool; size the pool for the
  number of processes. See [Sharding](/docs/4.1/sharding).
- **Migrations** belong in a deploy step before the bot starts, rather than in the factory, once the schema
  changes over time.
