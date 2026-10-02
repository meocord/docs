---
id: message-commands
title: Message commands
chapter: messages
order: 1
summary: Run a handler when a message matches a pattern, such as `!roll 20`, after the app's prefix or a mention.
learn:
  - Write a pattern and receive its params
  - Set prefixes for the app, a handler, or each server
  - Know which handler runs, and what a user is told on a misuse, an error or a cooldown
  - Give a command aliases, a scope and a help listing
requires: [first-command]
api:
  [
    decorators/MessageHandler,
    configuration/MessageHandlerOptions,
    configuration/MessageCommandOptions,
    responses/MessageUsageError,
  ]
since: 4.1.0
formerly: [messages-and-reactions]
---

A message command is a `@MessageHandler` with a pattern. A user types `!roll 20` in a channel, and the handler
runs with `{ sides: '20' }`. Patterns, prefixes and which handler wins are set in decorators and checked when
the bot starts, so a mistake stops the bot before it logs in rather than surfacing in chat.

## When to use it

Use a message command for text a user types in chat: a quick `!roll`, a moderation command staff type from
habit, or a bot that has always been prefix-driven. Slash commands are usually the better choice for anything
new: Discord shows their options, checks their types and works in every client, so reach for
[slash commands](guide:slash-commands) unless people will type the command.

For a handler that runs on every message, such as logging or auto-moderation, use `@MessageHandler()` with no
pattern, covered in [Reactions and other messages](guide:reactions). Reading a message's text needs the
privileged `MessageContent` intent, unless every command starts with a mention of the bot or works in direct
messages only.

## Example

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

With the app's prefix set to `!`, `!roll 20 for initiative` runs `roll` with `sides` and `note`. `@Validate`
turns `sides` into a number, and a message such as `!roll 1` is answered with the reason, so the handler only
sees a valid roll.

## How it works

A message goes through three steps before the handler runs:

1. **Start.** The message must begin with a prefix, or a mention of the bot when `mention` is on. A message
   with neither is chat, and no command handles it.
2. **Match.** The rest is split into words, and every pattern is matched against them. Only one patterned
   handler runs: the most specific match, as [Which handler runs](#which-handler-runs) explains.
3. **Pipeline.** The handler's [guards](guide:guards), [validation and pipes](guide:validation),
   [cooldowns](guide:cooldowns) and [filters](guide:exception-filters) run as they do for a command, with the
   params as the handler's second argument.

The handler receives the discord.js `Message` and answers it with `message.reply()` or
`message.channel.send()`. [`respond()`](api:responses/respond) is for interactions.

## Patterns

A pattern is matched word by word, with the same `{name}` params as a component's customId:

| In a pattern  | Matches                                                                                             |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `roll`        | The word `roll`, in any case unless `caseSensitive` is set                                          |
| `{name}`      | One word. Words in quotes, `"like this"` or `“like this”`, count as one, and the quotes are removed |
| `{name...}`   | The rest of the message, as typed. Only last                                                        |
| `{name?}`     | One word, or nothing. Only optional params follow it; `{name...?}` is the optional rest             |
| `{name:type}` | One word, read as a number, a member and so on                                                      |
| `{--name}`    | A flag, anywhere after the command word                                                             |

A pattern without params, such as `'ping'`, matches exactly that message, whatever the spacing between its
words. A param with no type keeps the case it was typed in and is a string. Typed params, flags and lists
have [their own page](guide:message-params).

## Prefixes

Set the prefix once, for the whole app, in `@MeoCord({ messages })`:

::example{file="app-beyond-commands.ts" region="app"}

- `prefix` is a string, or a list such as `['!', '?']`. The longest prefix that fits is used, and a space
  after it is allowed, so `! roll 20` works too. Without one, a pattern matches the message as it is.
- `mention: true` also accepts a mention of the bot, `@Bot roll 20`, in place of the prefix.
- `mention: 'only'` starts every command in a server with a mention of the bot, never a prefix. A direct
  message, addressed to the bot already, starts as usual. Discord sends a message's text without the
  privileged `MessageContent` intent when it mentions the bot, and in direct messages, so a mention-only bot
  needs no such intent.
- `caseSensitive: true` matches the prefix and a pattern's literal words in the case written. Param values
  always keep the case they were typed in.

A handler can set its own `prefix`, `caseSensitive` and `mention: 'only'`. Its prefix replaces the app's,
though a mention still counts. `prefix: ''` matches the message with no prefix, and `prefix: false` matches it
exactly as it is, never after a mention:

::example{file="controllers/message/dice.message.controller.ts" region="prefixes"}

### A prefix for each server

`prefix` can also be a function of the message, which returns a prefix or a list and may be async. It is
called for each message a handler needs the app's prefix for, so keep it to a lookup from a cache the bot
fills:

::example{file="app-with-guild-prefix.ts" region="app"}

A prefix function that finds no prefix for a message, returning an empty list, `undefined` or `null`, lets no prefix
start a command for it; a mention still does when `mention` is on. Return `''` to take the message as it is. A handler
with its own `prefix`, or `prefix: false`, runs for a message both it and the function could start, whatever the order
of your controllers.

A prefix function that throws goes to the app's global [exception filters](guide:exception-filters), then the
built-in fallback, and the handlers for every message still run.

## Which handler runs

Only one patterned handler runs for a message: the most specific one that matches, across every controller.

1. More literal words win: `roll 20` beats `roll {sides}`, which beats `{anything...}`.
2. Then a fixed number of words beats a rest: `roll {a} {b}` beats `roll {rest...}`.
3. Then a pattern without an optional param beats one with it, and fewer params beat more.
4. Patterns still equal go to the one whose first differing word is literal: `roll {x}` beats `{verb} 6`.

A handler whose `scope` fits where the message was sent comes first, so `help` can have a server handler and a
DM handler. The order is fixed at startup: declaration order and file layout never decide it. Two handlers that can
take the same messages stop the bot at startup, naming both: the same pattern behind starts that overlap, such as one
handler's own `'!'` and another's `['!', '?']`, or one's own `'!'` beside the app's `'!'`:

```text
A.roll: "roll" and "roll" in B.roll match the same messages, so only one of them could ever answer those. Change one pattern, or give one its own prefix.
```

An app's prefix function gives its prefixes only as each message arrives, so a handler using it is refused only beside
another that uses it too. Then every `@MessageHandler()` without a pattern runs, whether or not a pattern matched.

## Usage errors

A message that names a command, after a prefix or mention, but does not fit its pattern gets the command's
usage in reply, and the handler does not run:

```text
!pay @ana lots   ->  Usage: !pay <to> <amount> [note…]
                     amount: "lots" is not a valid whole number
```

The reply doesn't ping the user, and is deleted after 10 seconds; `deleteUsageRepliesAfter` in
`@MeoCord({ messages })` sets another number of seconds, and `0` keeps it. A guard that throws
`GuardDeniedError`, and input `@Validate` refuses, are answered the same way, with the reason. The texts are in
the server's language where the app's catalog translates them; see
[MeoCord's own texts](guide:localisation#meocords-own-texts).

These replies are plain text, so a test that checks them keeps passing when the theme's colours change.
`@MeoCord({ messages: { replyEmoji: true } })` begins each one with the call's `emojis.warning`, from the app's
theme, the handler's `@UseTheme`, or the server's or user's theme from `themeFor`. That covers a usage error, a
guard's or validation's reason, a `UserError`'s message, whether a command or an `@On` handler of a message event
threw it, and the direct messages of `dmOnError` and `dmOnCooldown`:

```text
⚠️ Usage: !roll <sides>
sides: "lots" is not a valid whole number
```

The error is a [`MessageUsageError`](api:responses/MessageUsageError), carrying `usage` and `issues`. It
reaches the handler's exception filters first, so a filter can answer in the app's own words, and
[observers](guide:observers) see its outcome as `'invalid'`.

### Naming only a command's first words

A message that names only a command's leading words, such as `!config` when `config set …` and `config get …`
exist, or an unknown subcommand, such as `!config reset`, gets the usage of each subcommand, one line per
handler:

```text
!config    ->  Usage:
               !config get <key>
               !config set <key> <value…>
```

A handler of its own, `config` or `config {key}`, still takes such a message. A subcommand with a
[guard](guide:guards), and one whose options say `hidden: true`, is left out of the list, since the list runs
no guards and must not name what a caller may be refused; named, it still gets its own usage.

## Telling the author privately

Two things a message command meets go unanswered in the channel: an error no filter handled, which is logged, and a
cooldown's refusal, which is skipped. A reply in the channel can't be private, so the author never learns why
nothing happened. Two options send them a direct message instead, both off by default:

::example{file="app-message-dm.ts" region="app"}

- `dmOnError` tells the author the command failed, naming it, the channel and the server, and why, as the fallback
  would answer: "!leaderboard in #general on Cat Cafe: An error occurred while executing the command." When the
  cooldown store is down, the reason is "Cooldowns can't be checked right now: try again shortly." The error is still
  logged.
- `dmOnCooldown` tells the author how long to wait, once per wait: retrying before it ends sends nothing more. The
  notice is counted in the app's cooldown store, so with a [shared store](guide:recipes/cooldown-stores) it holds across
  shards.

Only patterned handlers are answered, and only when no [exception filter](guide:exception-filters) handled the error.
The app above takes commands in servers only. A bot that also takes them in direct messages, with the
`DirectMessages` intent and discord.js's `Partials.Channel`, answers one sent there in that conversation. A member
whose direct messages are closed isn't told, and that's logged at debug level. A usage error, a guard's reason and a
`UserError` are answered in the channel as before. The texts are `meocord.dm.error` and `meocord.dm.cooldown`,
translated like [MeoCord's own texts](guide:localisation#meocords-own-texts).

::example{file="controllers/message/daily.message.controller.ts" region="controller"}

::example{file="controllers/message/daily.message.controller.spec.ts" region="spec"}

## Aliases, descriptions and scope

A handler's options say more about its command:

::playground{file="controllers/message/moderation.message.controller.ts" region="metadata" dispatch="message m <@140000000000000014> 1h"}

- `aliases` are other words for the command, in place of the words the pattern begins with: `!m @ana 1h` runs
  `mute`. A misuse is answered with the usage as the user typed it.
- An alias can be several words, such as `'cfg set'` for `config set {key} {value...}`, and is ranked by its own
  words.
- `description` is what the command does, for the help listing.
- `scope` is where the command works: `'guild'`, `'dm'` or `'any'`, the default. A message only an out-of-scope
  handler matches is answered `This command works in a server only.` or
  `This command works in direct messages only.` A command with a `member`, `role` or `channel` param works in
  servers only whatever its scope says, and `scope: 'dm'` with one stops the bot as it loads; see
  [Errors at startup](#errors-at-startup).
- `hidden: true` leaves the command out of the help listing and a parent's list of subcommands.

## A help command

`help: true` in `@MeoCord({ messages })` turns on a built-in `!help`. It lists the message commands the caller
can use where they asked, one line each with its `description`, and `!help <command>` shows one, by its words
or an alias:

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

- It answers only after a prefix or a mention. `help: { command: 'commands', aliases: ['h'] }` names other
  words.
- It runs the app's `@MeoCord({ guards })` first, as a command does, and so does a parent's list of subcommands: a
  guard that returns `false` leaves the message unanswered, and one that throws `GuardDeniedError` gets its reason as
  the reply.
- The list leaves out a command with a guard, on its method or its controller, and one marked `hidden`: `!ban`
  is missing above, since `OutranksTargetGuard` decides who may use it. Named, either is shown. A command that
  works only in servers is left out in a DM.
- `!help config`, for words with no handler of their own, lists their subcommands.
- An app's own `@MessageHandler('help …')` always runs instead, and the bot warns at startup that the built-in
  never answers the word.
- With `replyEmoji`, the reply begins with the theme's `emojis.info`. It isn't deleted, since the caller asked for
  it, and a reply over 2,000 characters is sent as several.

The reply is plain text, in the server's language where the app's catalog has MeoCord's help texts. To write it
another way, such as in an embed, give the app's [presenter](guide:presenters) a `messageHelp(help, message)`
method. `help` is what the built-in found: a `list`, one `command`, a `parent`'s subcommands, an `unknown`
name, or `empty`:

::example{file="presenters/help.presenter.ts" region="presenter"}

A help command of the app's own gets the same model from
[`HandlerRegistry.messageHelp(message, query?)`](api:controllers/HandlerRegistry), so which commands a caller
can reach, and which guards hide, are not worked out again:

::example{file="controllers/message/help.message.controller.ts" region="help"}

## Errors at startup

The message routes are built as the bot loads, and a mistake in a pattern stops it before it logs in. The report is
one line that begins with the handler and its pattern, such as
`DiceMessageController.swap: @MessageHandler('swap {a} {a}'):`, followed by the problem, and the process exits 1:

| Mistake                                          | What follows the handler                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| A rest before another word, `'{text...} please'` | `{text...} takes the rest of the message, so it must be last.`                              |
| A required word after an optional param          | `{name?} is optional, so only optional params may follow it; …`                             |
| Text, optional, before another optional param    | `{name?} comes before another optional param, so it needs a type …`                         |
| A type nothing adds, `'{accent:colour}'`         | `{accent:colour} names no type. The types are …`                                            |
| A name used twice, `'swap {a} {a}'`              | `{a} appears twice; give each param and flag its own name.`                                 |
| A flag's name that doesn't start with a letter   | `{--9lives}: a flag's name starts with a letter, as a message could not give it otherwise.` |
| Braces inside a word, `'a{b}'`                   | `"a{b}" is not a param: a param is a whole word, …`                                         |
| `scope: 'dm'` on a command with a `member` param | `scope is 'dm', but {target:member} is found only in a server.`                             |

Two patterns that match the same messages stop the bot too, naming both handlers: `… match the same messages, so
only one of them could ever run. Change one pattern, or give one its own prefix.` They match alike when they take the
same prefix and differ only in param names, as `'roll {sides}'` and `'roll {count}'` do, or only in case, unless both
are case-sensitive. An alias and a pattern count the same way.

## Testing

`resolveRoute(App, { content })` returns the handler a message reaches, with the params its pattern captures, from
decorator metadata alone. A message that starts with a mention of the bot needs the bot's id, as `botId`, and `dm: true`
resolves it as a direct message, where only handlers whose scope fits run: one scoped to servers, or with a `member`,
`role` or `channel` param, isn't returned, as dispatch answers such a message with its usage. `resolveRoute` can't call
a prefix function, so for an app that has one, pass the prefix the message has, as `prefix`; it throws a `TypeError`
without one. `module.dispatch(message)` sends the message through routing and the pipeline as the bot does, usage
replies and the built-in help included:

::example{file="controllers/message/economy.message.controller.spec.ts" region="spec"}

`module.invoke(Controller, 'method', message)` runs one handler, and first checks that dispatch would give it
the message: `!roll 20` for `roll {sides}`, in an app that also has a `roll 20` handler, rejects naming the
handler that runs. `invoke` calls an app's prefix function with the message, as the bot does:

::example{file="app-with-guild-prefix.spec.ts" region="spec"}

See [Invoke and dispatch](guide:invoke-and-dispatch) for when to use each.

## Gotchas

- **Nothing runs.** The bot needs the `GuildMessages` intent. A command started by a prefix or plain text also
  needs `MessageContent`, enabled both in `clientOptions` and in the Discord developer portal; the bot warns at
  startup when it is missing. Messages from bots never reach a handler.
- **A keyword stops working after adding a prefix.** The app's prefix applies to every patterned handler, so
  `'ping'` then needs `!ping`. Give a handler that should match the bare message `{ prefix: false }`.
- **Two handlers, one pattern.** Patterns that differ only in param names, such as `'roll {sides}'` and
  `'roll {count}'`, match the same messages and stop the bot at startup. Change one, or give one its own
  prefix.

## Build it

The feedback bot takes feedback from chat too. A member mentions the bot, names the kind of feedback, and
writes it:

```text
@Feedback feedback idea Add a dark mode
```

Add a message controller beside the slash command. It files through the same `FeedbackService`:

::example{file="tutorial/feedback.message.controller.ts" region="message-commands"}

`{about:bug|idea|praise}` takes one of three words, and `{details...}` the rest of the message. `scope: 'guild'`
keeps it to servers. In the app, add the controller, the `GuildMessages` intent that delivers messages in
servers, and `messages: { mention: 'only' }`, so a command starts with a mention of the bot, never a prefix:

::example{file="tutorial/app.ts" region="app"}

A mention carries its text without the privileged `MessageContent` intent, so the bot doesn't ask for it.
Try `@Feedback feedback wish Add a dark mode`: `wish` isn't one of the three words, so the bot answers with the
command's usage.

## Next steps

- [Typed params, flags and lists](guide:message-params): read members, numbers and options from the words.
- [Reactions and other messages](guide:reactions): handle every message, and reactions to them.
- [Guards](guide:guards): decide who may run a command, and tell them why not.
