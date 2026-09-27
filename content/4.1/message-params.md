---
id: message-params
title: Message command params
section: Beyond commands
order: 50.6
since: 4.1.0
---

A [message command](/docs/4.1/message-commands)'s params can be more than words: a number, a member, one of a
few choices or a type of the app's own, a flag given anywhere after the command, or a list. Each is read from
the message before the handler runs, and a word that doesn't fit gets the command's
[usage reply](/docs/4.1/message-commands#usage-errors).

## Typed params

A param can name a type, `{name:type}`. Its word is read as that type, and the handler receives a member
or a number rather than text:

::example{file="controllers/message/economy.message.controller.ts" region="typed"}

| Type                        | Gives                     | Accepts                                                     |
| --------------------------- | ------------------------- | ----------------------------------------------------------- |
| none, or `string`           | `string`                  | A word, or "quoted words"                                   |
| `int`, `number`             | `number`                  | `50`, `-3`; `number` also `2.5`                             |
| `bool`                      | `boolean`                 | `yes`, `no`, `true`, `false`, `on`, `off`                   |
| `duration`                  | `number`, in milliseconds | `90s`, `10m`, `2h30m`, `7d`, `1w`                           |
| `member`                    | `GuildMember`             | A mention or an ID, of a member of the message's server     |
| `user`                      | `User`                    | A mention or an ID                                          |
| `role`                      | `Role`                    | A mention, an ID or the role's name                         |
| `channel`                   | `GuildBasedChannel`       | A mention or an ID                                          |
| words, such as `on\|off`    | `'on' \| 'off'`           | One of the words, in any case unless `caseSensitive` is set |
| [your own](#your-own-types) | what its `parse` returns  | What its `parse` accepts                                    |

The handler's params are checked against the pattern when the code compiles: a name the pattern does not
have, a type its param's value does not fit, or an optional param declared as always there is an error.
`ParamsOf<'pay {to:member} {amount:int}'>` from `meocord/interface` is the type a pattern gives. A param
with no type is text that `@Validate` or a pipe may turn into anything, so it is not checked, and neither
are params declared as `Record<string, string>`.

A word that is not its type gets the command's [usage reply](/docs/4.1/message-commands#usage-errors), and so does
a member who is not in the server. A command with a `member`, `role` or `channel` param works in servers only: sent
in a DM, it is answered `This command works in a server only.`

### Optional params

Several optional params may end a pattern. Each one that another follows takes a word only if the word
fits its type, and is left out otherwise, so the word goes on to the next:

::example{file="controllers/message/economy.message.controller.ts" region="optionals"}

Whether a word fits is read from the word alone: a number, a length of time, one of the words to choose
from, or the mention or ID a member, user, role or channel is given as. So an optional param that another
follows needs a built-in type or words to choose from; text, or an app's own type, stops the bot at
startup. The last optional param takes any word, and a word of the wrong type there gets the usage reply.

### Your own types

An app adds types in `@MeoCord({ messages: { types } })`, and declares what each gives in
`MessageParamTypes`, so a handler using one is typed:

::example{file="message-types.ts" region="type"}

::example{file="app-message-commands.ts" region="app"}

`parse` returns the value, or `undefined` when the word is not one, which gets the usage reply built from
the type's `label`: `accent: "blue" is not a valid hex colour`. For a label in each server's language, give
the type a `labelKey` instead: see [MeoCord's own texts](/docs/4.1/localisation#meocords-own-texts). It
runs before the guards, so it must not call Discord. A type for something that has to be fetched returns an `EntityRef`, as the built-in entity types
do, and is resolved once the guards let the call through.

## Flags

A flag, `{--name}`, may be given anywhere after the command's first word, apart from the words the pattern
matches. Without a type it is `true` when given and `false` when not; with one, `{--name:type}`, it takes a
value, `--name=value`, and is required unless it ends in `?`:

::example{file="controllers/message/moderation.message.controller.ts" region="flags"}

- A value with spaces goes in quotes, `--note="buy milk"`. A flag given twice takes its last value, and
  `--bots=no` gives `false`.
- A flag the command does not have, and a typed flag left out or given no value, get the usage reply:
  `--all is not an option of this command`.
- A flag before the command's first word, as in `!--bots purge 5`, is not read, and the message names no
  command. A pattern that begins with a param has no command word, so its flags may come anywhere.
- Words in quotes are never flags, so `"--bots"` stays text. A pattern without flags reads `--bots` as an
  ordinary word, and a rest takes the message's text without its flags, keeping its own spacing and line
  breaks.
- A flag's name starts with a letter, then letters, digits or `_`. `{--9lives}` stops the bot at startup,
  since a message could not give it.

## Lists

A typed rest, `{name:type...}`, is a list: each remaining word, or "quoted words", becomes a value of the
type. `{name...}` with no type stays the rest of the message as text:

::example{file="controllers/message/moderation.message.controller.ts" region="lists"}

An item that is not a value of its type gets the usage reply. The members a list names are fetched
together, as typed params are.

## Guards and what they see

A command's params reach the [guards](/docs/4.1/guards) before anything is fetched from Discord. Numbers,
choices, flags and the shape of each ID are read first, without a request. The guards then see each member,
user, role and channel as an `EntityRef`: its `id`, the entity itself as `cached` when discord.js already
has it, and `resolve()` to fetch it. `ParamRefsOf<'pattern'>` from `meocord/interface` types the params that
way:

::example{file="guards/outranks-target.guard.ts" region="guard"}

- **A caller the guards refuse costs no request,** however many IDs the message names. Once the guards let
  the call through, whatever the cache lacks is fetched, and the handler, `@Validate`, pipes and
  `@Cooldown({ by })` get the entities themselves.
- **Each ID is fetched once,** however many messages and guards ask for it at the same time, so a guard's
  `resolve()` and the fetch after the guards share one request.
- **Much is never fetched.** A mentioned member arrives with the message, and roles and a server's
  channels are cached with the `Guilds` intent.
- **A caller on cooldown costs no request either.** The handler's cooldowns without `by` are checked
  before anything is fetched. A cooldown with `by` keys on the fetched params, so it is checked when it is
  counted.

A guard that throws `GuardDeniedError`, and a message `@Validate` refuses, are answered with the reason, as a
usage error is, and the reply is deleted after the same time. A guard that returns `false` denies silently.
A guard on a handler for every message, or on an `@On` handler, only filters what it takes, so its denial
gets no reply.
