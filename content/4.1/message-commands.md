---
id: message-commands
title: Message commands
section: Beyond commands
order: 50.5
since: 4.1.0
---

A message command is a `@MessageHandler` with a pattern: `!roll 20` in a channel runs a handler that
receives `{ sides: '20' }`. Patterns, prefixes and the order handlers win in are set in decorators, and
checked when the bot starts. Typed params, flags and lists are in
[Message command params](/docs/4.1/message-params). For handlers that run on every message, reactions and the
intents both need, see [Messages and reactions](/docs/4.1/messages-and-reactions).

## Patterns

A pattern is matched word by word, with the same `{name}` params as a component's customId, and the
params arrive as the handler's second argument:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

| In a pattern     | Matches                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------- |
| `roll`           | The word `roll`, in any case unless `caseSensitive` is set                                                |
| `{name}`         | One word. Words in quotes, `"like this"` or `“like this”`, count as one, and the quotes are removed       |
| `{name:type}`    | One word, read as a number, a member and so on; see [Typed params](/docs/4.1/message-params#typed-params) |
| `{name...}`      | The rest of the message, as typed. Only last                                                              |
| `{name:type...}` | Each of the remaining words, as a list of values of the type; see [Lists](/docs/4.1/message-params#lists) |
| `{name?}`        | One word, or nothing. Only optional params follow it; `{name...?}` is the optional rest                   |
| `{--name}`       | A flag, `--name`, anywhere after the command word; see [Flags](/docs/4.1/message-params#flags)            |

- A pattern without params, such as `'ping'`, matches exactly that message, whatever the spacing between
  its words.
- A param with no type keeps the case it was typed in, and is a string until
  [validation](#params-validation-and-cooldowns) converts it.
- The handler receives the discord.js `Message`, and answers it with `message.reply()` or
  `message.channel.send()`; `respond()` is for interactions.

## Usage errors

A message that names a command, after a prefix or mention, but does not fit its pattern gets the
command's usage in reply, and the handler does not run:

```text
!pay @ana lots   ->  Usage: !pay <to> <amount> [note…]
                     amount: "lots" is not a valid whole number
!pay @ana        ->  Usage: !pay <to> <amount> [note…]
                     amount is missing
```

- The reply does not ping the user, and is deleted after 10 seconds.
  `@MeoCord({ messages: { deleteUsageRepliesAfter } })` sets another number of seconds, and `0` keeps it.
- A reply the bot cannot send or delete, for a missing permission or a message already gone, is logged and
  left.
- A message with no prefix or mention is never taken for a command. In an app without a prefix,
  `pay @ana lots` is chat that happens to begin with a command's word, and gets no reply.

The error is a `MessageUsageError` from `meocord/common`, carrying `usage` and `issues`. It goes through the
handler's [exception filters](/docs/4.1/exception-filters) first, so a filter can answer it in the app's own
words. Its texts, the `Usage:` heading and each line of what is wrong, follow the app's translations in the
server's language, and are English otherwise; see [MeoCord's own texts](/docs/4.1/localisation#meocords-own-texts).

## Aliases, descriptions and scope

A handler's options say more about its command:

::example{file="controllers/message/moderation.message.controller.ts" region="metadata"}

- `aliases` are other words for the command, in place of the words the pattern begins with: `!m @ana 1h`
  runs `mute`. An alias can be several words, such as `'cfg set'` for `config set {key} {value...}`, is
  ranked by its own words, and answers a misuse with the usage as the user typed it.
- `description` is what the command does, for a [help command](#a-help-command).
- `scope` is where the command works: `'guild'`, `'dm'` or `'any'`, the default. A message only an
  out-of-scope handler matches is answered `This command works in a server only.` or
  `This command works in direct messages only.` A command with a `member`, `role` or `channel` param works
  in servers only whatever its scope says, and `scope: 'dm'` with one stops the bot at startup.

## A help command

`help: true` in `@MeoCord({ messages })` turns on a built-in `!help`. It lists the message commands the
caller can use where they asked, one line each with the `description` its handler gives, and
`!help <command>` shows one, by its words or an alias:

::example{file="app-message-commands.ts" region="app"}

```text
!help      ->  Commands:
               !kick <targets…>
               !mute <target> [duration] [reason…] — Times a member out, for 10 minutes unless told otherwise.
               !pay <to> <amount> [note…]
               !poll <question> <options…>
               !purge <count> [--bots] [--from=<from>]
               Type !help <command> for one command's usage.
!help m    ->  Usage: !mute <target> [duration] [reason…]
               Times a member out, for 10 minutes unless told otherwise.
               target: member · duration (optional): length of time, such as 10m · reason (optional): text
               Also: !m, !shush
               Works in servers only.
```

`!ban` is not listed: its `OutranksTargetGuard` decides who may use it, and help runs no guards.

- It is off unless asked for, and answers only after a prefix or a mention, as a usage error does.
  `help: { command: 'commands', aliases: ['h'] }` names other words.
- The list leaves out a command with a [guard](/docs/4.1/guards), on its method or its controller, since it
  runs no guards and must not name what a caller may be refused, and one whose options say `hidden: true`.
  Named, either is shown. A command that works only in servers is left out of the list in a DM.
- `!help config`, for words with no handler of their own, lists their subcommands. A name no command has,
  and nothing to list, get a line saying so.
- An app's own handler for the word, `@MessageHandler('help …')`, always runs instead, and the bot warns at
  startup that the built-in never answers it.
- With `replyEmoji`, the reply begins with the theme's `emojis.info`. It is not deleted, since the caller
  asked for it, and a reply over 2,000 characters is sent as several.

### Writing the help your own way

The reply is in the server's language wherever the app's catalog translates MeoCord's help texts, and in
English otherwise; see [MeoCord's own texts](/docs/4.1/localisation#meocords-own-texts). To write it another
way, such as in an embed, give the app's [presenter](/docs/4.1/presenters) a `messageHelp(help, message)` method. `help` is a `MessageHelp`,
what the built-in found: a `list` of commands, one `command`, a `parent`'s subcommands, an `unknown` name, or
`empty`. The method returns text, or the options `message.reply` takes:

::example{file="presenters/help.presenter.ts" region="presenter"}

### Your own `!help`

A help command of the app's own gets the same model from `HandlerRegistry.messageHelp(message, query?)`,
whether `messages.help` is on or off, so which commands a caller can reach, and which guards hide, are not
worked out again:

::example{file="controllers/message/help.message.controller.ts" region="help"}

`HandlerRegistry.list({ kind: 'message' })` also gives each message command's `command` words, `aliases`,
`description`, `scope`, `hidden`, `usage(prefix)` and `matches(words)`. See
[Handler discovery](/docs/4.1/handler-discovery) for the rest of the registry.

## Prefixes

Set the prefix once, for the whole app, with `@MeoCord({ messages })`:

::example{file="app-beyond-commands.ts" region="app"}

- `prefix` is a string, or a list such as `['!', '?']`. Without one, a pattern matches the message as it
  is. The longest prefix that fits is used, and a space after it is allowed, so `! roll 20` works too.
- `mention: true` also accepts a mention of the bot, `@Bot roll 20`, in place of the prefix, including in
  an app whose handlers all set their own prefix.
- `caseSensitive: true` matches the prefix and a pattern's literal words in the case written. It is off by
  default. Param values always keep the case they were typed in.

A handler can set its own `prefix` and `caseSensitive`. Its prefix replaces the app's, though a mention
still counts. `prefix: ''` matches the message without a prefix, and `prefix: false` matches the message
as it is, never after a mention:

::example{file="controllers/message/dice.message.controller.ts" region="prefixes"}

### A prefix for each server

`prefix` can also be a function of the message, which returns a prefix or a list and may be async. It is
called for each message some handler needs the app's prefix for, so keep it to a lookup, from a cache the
bot fills:

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

A handler whose `scope` fits where the message was sent runs before one whose scope does not, so `help`
can have a server handler and a DM handler. The order is fixed at startup, so declaration order and file
layout never decide it. Then every `@MessageHandler()` without a pattern runs, whether or not a pattern
matched. Messages from bots, the bot's own among them, and messages with no text reach no handler.

## Params, validation and cooldowns

A pattern's params go through [the same stages](/docs/4.1/how-a-handler-runs) as a component's customId
params:

- [`@Validate`](/docs/4.1/validation) checks them, and the handler receives the schema's output: the
  `roll` handler above gets `sides` as a number, and `!roll 1` is answered with the reason. Pipes transform
  them the same way.
- [`@Cooldown({ by })`](/docs/4.1/cooldowns#counting-per-resource) reads them to count per resource.
- Interceptors and filters read them with `ExecutionContext.getHandlerParams()`: the raw params before
  validation, and the validated ones after it. Guards read them as entity refs; see
  [Guards and what they see](/docs/4.1/message-params#guards-and-what-they-see).

`@Validate` and `@UsePipe` need a pattern: on a `@MessageHandler()` for every message, they stop the bot at
startup.

## Replies with the theme's emoji

MeoCord's replies to a message are plain text: a usage error, a guard's or validation's reason, and a
`UserError`'s message, whether a command or an `@On` handler of a message event threw it. A theme does not
change that text, so a test that checks it keeps passing when the colours change.
`@MeoCord({ messages: { replyEmoji: true } })` begins each of them with the call's `emojis.warning`: the
app's theme, a handler's `@UseTheme`, or the server's or user's theme from `themeFor`.

```text
⚠️ Usage: !roll <sides>
sides: "lots" is not a valid whole number
```

## Errors at startup

The message routes are built when the bot starts, and a mistake in them stops it with an error naming the
handler, before it logs in:

| Mistake                                                   | Error                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A rest before another word, `'{text...} please'`          | `{text...} takes the rest of the message, so it must be last.`                              |
| A required word after an optional param                   | `{name?} is optional, so only optional params may follow it; …`                             |
| Text, optional, before another optional param             | `{name?} comes before another optional param, so it needs a type …`                         |
| A type no one added, `'{accent:colour}'`                  | `{accent:colour} names no type. The types are …`                                            |
| A name used twice, `'swap {a} {a}'`                       | `{a} appears twice; give each param and flag its own name.`                                 |
| A flag's name that does not start with a letter           | `{--9lives}: a flag's name starts with a letter, as a message could not give it otherwise.` |
| Braces inside a word, `'a{b}'`                            | `"a{b}" is not a param: a param is a whole word, …`                                         |
| `scope: 'dm'` on a command with a `member` param          | `scope is 'dm', but {target:member} is found only in a server.`                             |
| Two patterns, or an alias and a pattern, that match alike | `… match the same messages, so only one of them could ever run.`                            |

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

For typed params, give the message a server whose caches hold what the command names:
`createMockGuild({ members, roles, channels })`, then `createMockMessage({ guild })`, or `guild: null` for a
DM. `module.dispatch(message)` sends the message through routing as the bot does, usage replies included:

::example{file="controllers/message/economy.message.controller.spec.ts" region="spec"}

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
