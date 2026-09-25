---
id: message-commands
title: Message commands
section: Beyond commands
order: 50.5
since: 4.1.0
---

A message command is a `@MessageHandler` with a pattern: `!roll 20` in a channel runs a handler that
receives `{ sides: '20' }`. Patterns, prefixes and the order handlers win in are set in decorators, and
checked when the bot starts. For handlers that run on every message, reactions and the intents both need,
see [Messages and reactions](/docs/4.1/messages-and-reactions).

## Patterns

A pattern is matched word by word, with the same `{name}` params as a component's customId, and the
params arrive as the handler's second argument:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

| In a pattern | Matches                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `roll`       | The word `roll`, in any case unless `caseSensitive` is set                                          |
| `{name}`     | One word. Words in quotes, `"like this"` or `“like this”`, count as one, and the quotes are removed |
| `{name...}`  | The rest of the message, as typed. Only last                                                        |
| `{name?}`    | One word, or nothing. Only last; `{name...?}` is the optional rest                                  |

- A pattern without params, such as `'ping'`, matches exactly that message, whatever the spacing between
  its words.
- A param value keeps the case it was typed in, and is always a string until
  [validation](#params-validation-and-cooldowns) converts it.
- The handler receives the discord.js `Message`, and answers it with `message.reply()` or
  `message.channel.send()`; `respond()` is for interactions.

## Prefixes

Set the prefix once, for the whole app, with `@MeoCord({ messages })`:

::example{file="app-beyond-commands.ts" region="app"}

- `prefix` is a string, or a list such as `['!', '?']`. Without one, a pattern matches the message as it
  is. The longest prefix that fits is used, and a space after it is allowed, so `! roll 20` works too.
- `mention: true` also accepts a mention of the bot, `@Bot roll 20`, in place of the prefix.
- `caseSensitive: true` matches the prefix and a pattern's literal words in the case written. It is off by
  default.

A handler can set its own `prefix` and `caseSensitive`. Its prefix replaces the app's, though a mention
still counts, and `prefix: false` matches the message as it is:

::example{file="controllers/message/dice.message.controller.ts" region="prefixes"}

### A prefix for each server

`prefix` can also be a function of the message, which returns a prefix or a list and may be async. It is
called for each message, so keep it to a lookup, from a cache the bot fills:

::example{file="app-with-guild-prefix.ts" region="app"}

A prefix function that throws goes to the app's global [exception filters](/docs/4.1/exception-filters),
then the built-in fallback, and the handlers for every message still run.

## Which handler runs

Only one patterned handler runs for a message: the most specific one that matches, across every
controller.

1. More literal words win: `roll 20` beats `roll {sides}`, which beats `{anything...}`.
2. Then a fixed number of words beats a rest: `roll {a} {b}` beats `roll {rest...}`.
3. Then a pattern without an optional param beats one with it, and fewer params beat more.
4. Patterns still equal go to the one whose first differing word is literal: `roll {x}` beats `{verb} 6`.

The order is fixed at startup, so declaration order and file layout never decide it. Then every
`@MessageHandler()` without a pattern runs, whether or not a pattern matched. Messages from bots, the
bot's own among them, and messages with no text reach no handler.

## Params, validation and cooldowns

A pattern's params go through [the same stages](/docs/4.1/how-a-handler-runs) as a component's customId
params:

- [`@Validate`](/docs/4.1/validation) checks them, and the handler receives the schema's output: the
  `roll` handler above gets `sides` as a number, and `!roll 1` is refused with a `ValidationError`. Pipes
  transform them the same way.
- [`@Cooldown({ by })`](/docs/4.1/cooldowns#counting-per-resource) reads them to count per resource.
- Guards, interceptors and filters read them with `ExecutionContext.getHandlerParams()`: the raw params
  before validation, and the validated ones after it.

`@Validate` and `@UsePipe` need a pattern: on a `@MessageHandler()` for every message, they stop the bot at
startup.

## Errors at startup

The message routes are built when the bot starts, and a mistake in them stops it with an error naming the
handler, before it logs in:

| Mistake                                          | Error                                                                                   |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| A rest before another word, `'{text...} please'` | `{text...} takes the rest of the message, so it must be last.`                          |
| An optional param before another word            | `{name?} is optional, so it must be last.`                                              |
| A name used twice, `'swap {a} {a}'`              | `{a} appears twice; give each param its own name.`                                      |
| Braces inside a word, `'a{b}'`                   | `"a{b}" is not a param: a param is a whole word, such as {name}, {name...} or {name?}.` |
| Two patterns that match the same messages        | `… match the same messages, so only one of them could ever run.`                        |

A pattern error begins with the handler it is about, such as `@MessageHandler('swap {a} {a}') in
DiceMessageController.swap:`, and the last names both handlers. Two patterns match the same messages when
they take the same prefix and differ only in param names, as `'roll {sides}'` and `'roll {count}'` do, or
only in case, unless both are case-sensitive; change one pattern, or give one its own prefix.

## Testing

`resolveRoute(App, { content })` from `meocord/testing` returns the handler a message reaches, with the
params its pattern captures, from decorator metadata alone. A mention needs the bot's id, as `botId`.

With the app given to the testing module, `invoke` matches a message after the app's prefix, as the bot
does, and passes the handler the params its pattern captures, through validation and pipes:

::example{file="controllers/message/dice.message.controller.spec.ts" region="spec"}

A message the handler's pattern does not match is refused before anything runs, so a typo in a test fails
rather than passing silently.

`resolveRoute` cannot call a prefix function, so for an app that has one, pass the prefix the message has.
`invoke` calls the function with the message, as the bot does:

::example{file="app-with-guild-prefix.spec.ts" region="spec"}

## Upgrading from 4.0

In 4.0, `@MessageHandler(keyword)` matched a message whose whole text was exactly the keyword, and every
matching handler ran. A 4.0 keyword is a pattern without params, and still matches the whole message, with
three differences:

- **Case.** `@MessageHandler('hello')` also matches `Hello` and `HELLO`. Set `caseSensitive: true` on the
  app or the handler to match the case written.
- **Words.** A keyword is compared word by word, so `'hello there'` also matches `hello   there`.
- **One handler.** Only the most specific pattern runs. Two handlers with the same keyword stop the bot at
  startup; merge them into one. One handler under two spellings, such as `@MessageHandler('baka')` and
  `@MessageHandler('Baka')`, is one route and keeps working, and the second decorator can go.

A prefix set in `@MeoCord({ messages })` applies to every patterned handler, existing keywords included, so
`'ping'` then needs `!ping`. A handler that should keep matching the bare message takes `{ prefix: false }`.
In an app without a prefix, a keyword that includes one, such as `'!ping'`, keeps matching `!ping`.

See [Upgrading from 4.0 to 4.1](/docs/4.1/migrating#message-keywords-match-in-any-case-and-only-one-runs).
