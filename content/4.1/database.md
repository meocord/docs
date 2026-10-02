---
id: database
title: A database
chapter: appendix
group: recipes
order: 2
summary: Keep a bot's data in PostgreSQL, with one pool provided before login and stores that tests can replace.
requires: [services, lifecycle-hooks, defer, testing]
api: [utilities/createToken, decorators/Inject, decorators/MeoCord, decorators/Defer, testing/MeoCordTestingModule]
since: 4.1.0
formerly: [recipe-database]
---

A bot that saves notes for each user in PostgreSQL. The connection pool is a [provider](guide:services#providers),
made once before the bot logs in and injected by a token into the stores that query it. Handlers inject the stores,
and tests replace either one. The same shape works for any client library.

## The code

The pool is provided under a token that [`createToken`](api:utilities/createToken) types with what it provides. The
factory is async, and creates the table the first time:

::example{file="recipes/database/database.ts" region="provider"}

The store is a [service](guide:services) that injects the pool with `@Inject(DATABASE)`. It holds the queries and
nothing else, and every value reaches the database as a parameter:

::example{file="recipes/database/notes.store.ts" region="store"}

The controller injects the store. A query can outlast the three seconds Discord gives for a first answer, so both
commands acknowledge privately first with [`@Defer`](guide:defer):

::example{file="recipes/database/notes.controller.ts" region="controller"}

The app lists the provider. The store needs no listing, because the controller injects it:

::example{file="recipes/database/app.ts" region="app"}

## How it works

- **Before login.** `start()` makes every provided value first, awaiting an async factory, so no class ever
  injects a promise. A database that refuses the connection rejects `start()`: MeoCord logs which factory failed and
  why, the exit code is set to 1, and the bot never logs in.
- **One pool.** A provided value is made once, so every store that injects `DATABASE` shares the same pool.
- **Closing it.** The value the factory returns has an `onShutdown` hook of its own. Hooks stop in reverse
  dependency order, so the pool closes after every class that injects it has stopped. See
  [Lifecycle hooks](guide:lifecycle-hooks#onshutdown).
- **The connection string.** `DATABASE_URL` comes from the environment, which `meocord.config.ts` loads before the
  factory runs. See [Environment variables](guide:configuration#environment-variables).

### Testing it

The controller's tests give the testing module an in-memory store in place of `NotesStore`, so they need no
database:

::example{file="recipes/database/notes.controller.spec.ts" region="spec"}

The store's own tests provide a stand-in pool under the same token, so its queries run against a mock:

::example{file="recipes/database/notes.store.spec.ts" region="spec"}

A test of the whole app builds it from `@MeoCord` with
[`MeoCordTestingModule.fromApp`](api:testing/MeoCordTestingModule), replacing only the pool. The factory never runs,
so nothing connects:

::example{file="recipes/database/app.spec.ts" region="spec"}

## Variations

### Another client

An ORM or another driver goes in the same place: construct and connect it in the factory, and close it in the
returned value's `onShutdown`.

### Native drivers

A driver with a compiled binary, such as a SQLite binding, works with
[self-contained builds](guide:self-contained-builds), which pack it into `dist`.

### Process sharding

With a process per shard, each process runs its own container, so each has its own pool. Size the pool for the
number of processes. See [Sharding](guide:sharding#a-process-per-shard).

### Migrations

Once the schema changes over time, run migrations in a deploy step before the bot starts, rather than in the factory.

## Next steps

- [Services and injection](guide:services): providers, tokens and the shapes a provider takes.
- [Testing](guide:testing#testing-the-whole-app): `fromApp`, and replacing what a test must.
- [Cooldown stores](guide:recipes/cooldown-stores): a cooldown store that injects this pool.
