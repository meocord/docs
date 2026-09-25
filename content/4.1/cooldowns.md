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

A blocked call throws `CooldownError` from `meocord/common`, which the built-in fallback answers only to the
caller: "Slow down: try again in 12s." `cooldownMessage(retryAfterMs)` builds that text, and an exception
filter catching `CooldownError` can say it another way, or in the user's language.

The cooldown is the last stage before the handler: guards, validation and pipes have let the call through,
so a denied call or bad input spends nothing. It applies to interaction and message handlers. On a
controller, it applies to each of those handlers separately.

Cooldowns are counted under the controller's class name, so the bot refuses to start when two classes share
a name and either has a cooldown; rename one of them.

::example{file="controllers/slash/daily.slash.controller.spec.ts" region="spec"}

## Where calls are counted

By default, in the bot's memory. With process sharding each shard counts on its own, so `'user'` and
`'global'` cooldowns allow more than they say, and the bot warns at startup; `'guild'` and `'channel'` stay
exact, since a server lives on one shard.

To share one count, extend `CooldownStore` and pass it to `@MeoCord({ cooldownStore })`. It is resolved like a
service, so it can inject its client, and its `consume` must check and record a call in one step, so two
calls at the limit cannot both pass. In tests, each testing module counts in a fresh store.
