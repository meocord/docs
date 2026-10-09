---
id: message-params
title: Typed params, flags and lists
chapter: messages
order: 2
summary: Read numbers, members, lengths of time and options from a message command's words, checked before the handler runs.
learn:
  - Give a param a type, and receive the value
  - Let a guard look at a member before anything is fetched
  - Take flags and lists, and add a type of the app's own
requires: [message-commands]
api: [types/ParamsOf, types/ParamRefsOf, types/EntityRef, configuration/MessageParamType, responses/MessageUsageError]
since: 4.1.0
---

A param with a type, `{amount:int}`, gives the handler a number instead of the word the user typed. A word that
is not a value of its type never reaches the handler: the user gets the command's usage, naming the param and
what was wrong with it.

## When to use it

Type a param whenever the handler needs more than text: an amount, a member to act on, a length of time. The
check happens once, before any guard runs, so the handler doesn't parse or validate the word itself.

For a rule about the value, such as "at most 100", use [`@Validate`](guide:validation) on the typed value.
For words the command doesn't have in a fixed place, such as `--bots`, use a flag.

## Example

::example{file="controllers/message/economy.message.controller.ts" region="typed"}

`!pay @ana 25 for lunch` runs `pay` with Ana as a `GuildMember`, `25` as a number and `note` as the text
after it. `!pay @ana lots` gets `amount: "lots" is not a valid whole number` in reply.

## How it works

A message command's words are read in two steps around the [guards](guide:guards):

1. **Parse.** Before the guards, each word is read without asking Discord: numbers, words to choose from,
   flags, and the shape of each mention or ID. A word of the wrong type gets the usage reply.
2. **Fetch.** Once the guards let the call through, each member, user and channel the cache lacks is fetched; a role is
   read from the cache, or found by its name, in the first step. The handler, `@Validate`, pipes and `@Cooldown({ by })`
   get the entities themselves.

So a caller the guards refuse costs no request to Discord. Each ID is fetched once, however many messages ask
for it at the same time, and members go 100 to a request.

## Types

| Type                                 | Gives                     | Accepts                                                     |
| ------------------------------------ | ------------------------- | ----------------------------------------------------------- |
| none, or `string`                    | `string`                  | A word, or "quoted words"                                   |
| `int`, `number`                      | `number`                  | `50`, `-3`; `number` also `2.5`                             |
| `bool`                               | `boolean`                 | `yes`, `no`, `true`, `false`, `on`, `off`                   |
| `duration`                           | `number`, in milliseconds | `90s`, `10m`, `2h30m`, `7d`, `1w`                           |
| `member`                             | `GuildMember`             | A mention or an ID, of a member of the message's server     |
| `user`                               | `User`                    | A mention or an ID                                          |
| `role`                               | `Role`                    | A mention, an ID or the role's name                         |
| `channel`                            | `GuildBasedChannel`       | A mention or an ID                                          |
| words, such as `on\|off`             | `'on' \| 'off'`           | One of the words, in any case unless `caseSensitive` is set |
| your own, from `messages: { types }` | what its `parse` returns  | What its `parse` accepts                                    |

The handler's params are checked against the pattern when the code compiles. A name the pattern doesn't have, a type its
value doesn't fit, or an optional param declared as always there is an error in the editor.
[`ParamsOf`](api:types/ParamsOf) gives the type a pattern produces, for a helper that takes the same params. An untyped
param is text that `@Validate` or a pipe may change, so only whether it is optional is checked.

### Several optional params

A pattern may end in several optional params. Each one that another follows takes a word only if the word
fits its type, and is skipped otherwise, so the word goes on to the next:

::example{file="controllers/message/economy.message.controller.ts" region="optionals"}

Whether a word fits is read from the word alone, so an optional param that another follows needs a built-in
type or words to choose from. Text, or an app's own type, there stops the bot at startup. The last optional
takes any word.

## Guards see references

Before the fetch, a guard gets each member, user, role and channel as an
[`EntityRef`](api:types/EntityRef): its `id`, the entity as `cached` when discord.js already has it, and
`resolve()` to fetch it. [`ParamRefsOf`](api:types/ParamRefsOf) types a guard's params from the pattern:

::example{file="guards/outranks-target.guard.ts" region="guard"}

Put the cheap checks first. A caller without the permission is refused here without a single request, and
`resolve()` is only called for a caller who might pass. Whatever `resolve()` fetched is reused for the handler.

## Flags

A flag, `{--name}`, may be given anywhere after the command's word. Without a type it is `true` when given and
`false` when not. With one, `{--name:type}`, it takes a value, `--name=value`, and is required unless it ends
in `?`:

::example{file="controllers/message/moderation.message.controller.ts" region="flags"}

- A value with spaces goes in quotes: `--note="buy milk"`. A flag given twice takes its last value. An untyped
  flag also takes `yes`, `no`, `on`, `off`, `true` or `false`, so `--bots=no` gives `false`.
- A flag the command doesn't have gets the usage reply: `--all is not an option of this command`. So does a typed
  flag left out, `--from is missing`, or given no value, `--from needs a value, such as --from=<from>`.
- A flag before the command's first word, as in `!--bots purge 5`, isn't read, and the message names no command. A
  pattern that begins with a param has no command word, so its flags may come anywhere.
- Words in quotes are never flags, so `"--bots"` stays text. A command with no flags reads `--bots` as an ordinary
  word. A rest takes the message's text without its flags, keeping its own spacing and line breaks.
- A flag's name starts with a letter, then letters, digits or `_`. `{--9lives}` stops the bot as it loads, since a
  message couldn't give it; see [Errors at startup](guide:message-commands#errors-at-startup).

## Lists

A typed rest, `{name:type...}`, is a list: each word, or "quoted words", becomes a value of the type:

::playground{file="controllers/message/moderation.message.controller.ts" region="lists" dispatch="message poll Lunch? pizza soup; message kick <@140000000000000014> <@140000000000000015>"}

The members a list names are fetched together, in one request. `{name...}` with no type stays the rest of
the message as text, with its own spacing and line breaks.

## A type of your own

An app adds types in `@MeoCord({ messages: { types } })`. A type has a `label`, the noun the usage reply
names it by, and a `parse` that returns the value, or `undefined` for a word that isn't one. Declare what it
gives in `MessageParamTypes` so handlers using it are typed:

::example{file="message-types.ts" region="type"}

Then `{accent:color}` in a pattern gives the handler a number, and a word such as `blue` gets
`accent: "blue" is not a valid hex colour` in reply.

## Testing

`module.dispatch(message)` reads params as the bot does. Members the message's server caches resolve without
a request, so build the guild with them:

::example{file="controllers/message/economy.message.controller.spec.ts" region="spec"}

## Gotchas

- **A member param in a DM.** A command with a `member`, `role` or `channel` param works in a server only,
  and a DM is answered that way. The help listing says so too, with no `scope` needed.
- **A member who left.** A `member` param for someone not in the server is answered only to a caller the
  guards let through, so a refused caller learns nothing about the server.
- **`{amount:int}` and `@Validate`.** The type runs first. A schema that expects the word as a string gets a
  number.

## Build it

Members ask the bot where their feedback stands: `@Feedback status 3` says whether feedback #3 is open,
approved or rejected, and `--details` quotes what it said.

::example{file="tutorial/feedback.message.controller.ts" region="message-params"}

`{id:int}` gives the handler a number, so `@Feedback status lots` is answered with the usage and
`"lots" is not a valid whole number`. `{--details}` is `true` only when the message gives it. Feedback that
doesn't exist gets its own answer, from the same `FeedbackNotFoundError` the review buttons meet.

## Next steps

- [Reactions and other messages](guide:reactions): act on reactions, and on every message.
- [Validation and pipes](guide:validation): set rules on a typed value.
- [Guards](guide:guards): refuse a caller, and tell them why.
