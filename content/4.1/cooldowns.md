---
id: cooldowns
title: Cooldowns
chapter: pipeline
order: 5
summary: Limit how often a handler runs, per user, server, channel or resource, and choose where the calls are counted.
learn:
  - Limit a handler with one cooldown or several stacked
  - Count per user, server or channel, or per resource with by
  - Answer a refused call your own way
  - Keep counts in a shared store, and decide what happens when it fails
requires: [guards, validation]
api:
  [
    decorators/Cooldown,
    types/CooldownOptions,
    responses/CooldownError,
    utilities/cooldownMessage,
    utilities/CooldownStore,
    utilities/MemoryCooldownStore,
    decorators/MeoCord,
  ]
since: 4.1.0
formerly: [tutorial-polish]
---

[`@Cooldown`](api:decorators/Cooldown) limits how often a handler runs: at most `uses` calls within `seconds`,
counted per user unless you say otherwise. A call over the limit doesn't run, and only the caller is told how long
to wait.

## When to use it

Use a cooldown for any limit on how often: a daily reward, a command that calls a paid API, a button that spams a
channel, a message command someone could repeat in a loop.

A limit that isn't about frequency, such as who may run a command or where, is a [guard](guide:guards). A limit
Discord already applies, such as a channel's slowmode, needs no cooldown.

## Example

::playground{file="controllers/slash/daily.slash.controller.ts" region="cooldown" dispatch="/daily; /daily" expect="refused"}

Each user can claim `/daily` five times a minute, and never twice within three seconds. A call the three-second
limit refuses doesn't spend one of the five.

## How it works

The window slides: each use comes back `seconds` after it was spent, rather than every use at once at the top of a
minute.

A call is counted last, after its [guards](guide:guards), [validation](guide:validation) and pipes, just before
the handler. A denied call or bad input spends nothing.

Stacked cooldowns are checked together, a controller's first. A call is counted against all of them only if all
allow it. When some refuse, it's told the longest wait among them. On Redis Cluster, that takes one
[option](guide:recipes/cooldown-stores#redis-cluster).

A refused call throws [`CooldownError`](api:responses/CooldownError), which the built-in fallback answers only to the
caller: "Slow down: try again in 12 seconds.", the end of the wait shown as a Discord timestamp that counts down. An
interaction gets it privately. A message command's refusal is skipped, since
a reply in the channel can't be private, unless the app turns on
[`dmOnCooldown`](guide:message-commands#telling-the-author-privately), which tells the author once per wait.

`@Cooldown` works on interaction and message handlers. On a controller, it applies to each of its handlers apart, so
a controller's `uses: 3` gives every handler three.

A message command whose params name members, users, roles or channels is checked sooner too. Before they're fetched
from Discord, the call is checked against its cooldowns without being counted, so a call on cooldown costs no
requests.

## Options

| Option    | Default  | What it does                                                                                     |
| --------- | -------- | ------------------------------------------------------------------------------------------------ |
| `seconds` | none     | The window's length, from `0.001` to `4320000000000`, counted in whole milliseconds.             |
| `uses`    | `1`      | Calls allowed within the window.                                                                 |
| `per`     | `'user'` | Whose calls count together: `'user'`, `'guild'`, `'channel'` or `'global'`.                      |
| `bypass`  | none     | `(context) => boolean`: exempts a call without counting it, one from an owner for instance.      |
| `by`      | none     | `(context, params) => string \| number \| undefined`: counts calls apart by a value of the call. |

Outside a server, `'guild'` and `'channel'` count per user.

## Counting per resource

`per` decides whose calls count together, and `by` splits that count by a value of the call, such as the account a
button acts on. A user with three game accounts can check each of them in once an hour:

::example{file="controllers/button/check-in.button.controller.ts" region="by"}

`by` gets the call's `ExecutionContext` and the handler's params as the handler gets them: a component's customId
params, a command's options, a modal's fields, after validation and pipes. For a piped object, return a stable id from
it, such as `({ account }) => account.uid`.

- Declare the params `by` reads, or pass them as the type argument, `@Cooldown<{ uid: string }>({ … })`. A key the
  handler doesn't receive, or receives as another type, fails to compile; undeclared, they're
  `Record<string, unknown>`.
- With `per: 'global'`, the limit is per resource across every user.
- Returning `undefined` counts the call as though there were no `by`.
- An error `by` throws goes to the [exception filters](guide:exception-filters), and no cooldown on the handler counts
  the call.
- The value becomes part of the key the store counts under, encoded so a value holding `:` can't count under another's
  key. `inspectHandler(...).cooldowns` reports `by: true` for a cooldown that has one.

The guard runs first, so a stranger pressing someone else's button is refused without spending the owner's
check-in:

::example{file="controllers/button/check-in.button.controller.spec.ts" region="spec"}

## Answering a refused call

A call a cooldown refuses is answered privately with `meocord.cooldown.until`: "Slow down: try again {when}.", where
`{when}` is the time the wait ends as a Discord timestamp, `<t:…:R>`. Discord words it in the reader's language ("in 5
minutes", "in 23 hours") and counts it down. The rest of the text is in the user's language where the app
[translates MeoCord's texts](guide:localisation).

To answer another way, catch `CooldownError` in an [exception filter](guide:exception-filters).
[`error.retryAt`](api:responses/CooldownError#retryAt) is the `Date` the next call is allowed, and
[`error.limit`](api:responses/CooldownError#limit) is the `uses` and `windowMs` of the cooldown that refused it:

::example{file="filters/wait.filter.ts" region="filter"}

[`translateError(error, t, interaction)`](api:utilities/translateError) gives MeoCord's own text in the user's
language. `error.message`, like [`cooldownMessage(retryAfterMs)`](api:utilities/cooldownMessage), is plain text for
logs and tests. It gives the wait in its two biggest units with the smaller rounded up, so it never says less than the
wait: "Slow down: try again in 23h 59m.", "… in 1d.", "… in 2d 3h."

## Where calls are counted

By default, in the bot's memory. To keep counts across restarts, or share them between processes, bind another store
with [`@MeoCord({ cooldownStore })`](api:decorators/MeoCord#cooldownStore):

| Store                               | Counts                                            | Survives a restart               | Across hosts         |
| ----------------------------------- | ------------------------------------------------- | -------------------------------- | -------------------- |
| `MemoryCooldownStore` (the default) | In this process; per shard with process sharding  | No                               | No                   |
| `ShardedCooldownStore`              | In the shard manager, for every shard on the host | A shard's restart, not the bot's | No                   |
| `RedisCooldownStore`                | On the Redis server                               | Yes                              | Yes                  |
| Your own `CooldownStore`            | Where it keeps them                               | As its database does             | As its database does |

[Cooldown stores](guide:recipes/cooldown-stores) sets up each one, and builds a store for PostgreSQL, SQLite and
MongoDB.

Each cooldown's count is kept under a key named for its window, `Controller.method#<windowMs>…`, so a deploy that adds,
removes or reorders `@Cooldown`s leaves the others' counts as they were. Changing a cooldown's `uses` keeps the calls
counted so far, held to the new number; changing its `seconds` starts its count again. A handler's cooldowns with the
same `seconds`, `per`, `by` and `bypass` count the same calls, so they share one count, held to the smallest `uses`. The
exception is two cooldowns over the same `seconds` and `per`, both with `by` or both without, whose `by` or `bypass`
functions differ (two inline functions differ even when written alike): `uses` tells them apart, so for those, changing
`uses`, or adding or removing another such cooldown, starts their counts again, and reordering two with the same `uses`
swaps their counts.

## When the store fails

A shared store can be down, restarting or cut off. When it throws, rejects or doesn't answer within
`cooldownStoreTimeoutMs`, a second by default and at most `2147483647`,
[`cooldownStoreFailure`](api:decorators/MeoCord#cooldownStoreFailure) decides what the call gets:

::example{file="recipes/cooldown-stores/app-store-failure.ts" region="app"}

- **`'deny'`**, the default, refuses the call with `CooldownStoreError` from `meocord/common`, since a cooldown
  that can't be checked isn't known to allow it. A call the store counts after the timeout is given back, so the
  refused caller loses no use. The fallback answers an interaction privately with `meocord.cooldown.storeDown`,
  "Cooldowns can't be checked right now: try again shortly." A message command can't be answered privately in its
  channel: with `messages.dmOnError` on, its author gets a direct message once per outage, `meocord.dm.error` with
  that text as its reason, or `meocord.cooldown.storeDown` alone for a command sent in a direct message. Without it,
  the command is skipped silently. An [exception filter](guide:exception-filters) that catches `CooldownStoreError`
  can say it another way, or in the user's language, and [observers](guide:observers) see the outcome `'error'`, with
  that error.
- **`'allow'`** runs the call without counting it, keeping the bot available while the store is down.

Either way, the failure is logged once per outage, with its cause, and again when the store answers, with how many
calls failed. An outage ends when the store answers 30 seconds or more after its latest failure, so a store that fails
some calls and answers others, such as a Redis Cluster with one node down, is logged once rather than for every
failing call.

## Testing

Each testing module counts in a fresh in-memory store, so a test starts with every cooldown unused:

::example{file="controllers/slash/daily.slash.controller.spec.ts" region="spec"}

To test against another store, provide it: `{ provide: CooldownStore, useValue: store }`.

## Gotchas

> [!WARNING]
> With [process sharding](guide:sharding), the default store counts per shard, so `'user'` and `'global'`
> cooldowns allow a multiple of what they say. The bot warns at startup; bind `ShardedCooldownStore` or a shared
> store. `'guild'` and `'channel'` stay exact, since a server lives on one shard.

- **Two classes with one name can't share counts.** Calls are counted under the class name, so when either of two
  same-named classes has a cooldown, the bot refuses to start. Rename one.
- **A `bypass` call isn't counted.** An owner who tests a command doesn't use up anyone's limit, nor their own.

## Build it

The feedback bot takes a report from anyone, as often as they like. Limit each member to one report every five
minutes:

::example{file="tutorial/feedback.controller.ts" region="step:cooldowns"}

Run `/feedback`, send the form, and run `/feedback` again: the form doesn't open, and the bot tells only you how long
to wait, such as "Slow down: try again in 5 minutes."

## Next steps

- [Exception filters](guide:exception-filters): answer `CooldownError` in your own words.
- [Cooldown stores](guide:recipes/cooldown-stores): count in Redis, across shards, or in your own database.
- [Observers](guide:observers): count refused calls, which report the outcome `'cooldown'`, in your metrics.
