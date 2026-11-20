---
id: formatting
title: Formatting
chapter: structure
order: 5
summary: Point at a command, write a length of time or a list of permissions in the reader's language, and fit text to Discord's limits.
learn:
  - Mention one of your slash commands so a reader can click it
  - Write a duration and name permissions in the reader's language
  - Split a long text into messages Discord takes, and shorten one to a field's limit
  - Import discord.js's formatters from the same place
requires: [slash-commands, localisation]
api:
  [
    utilities/commandMention,
    utilities/formatDuration,
    utilities/permissionNames,
    utilities/splitMessage,
    utilities/truncate,
    utilities/DiscordLimits,
    types/FormatDurationOptions,
    types/PermissionNamesOptions,
  ]
since: 4.3.0
---

`meocord/common` has the helpers a reply needs to read well: a clickable mention of one of your commands, a length of
time and a list of permissions written in the reader's language, and text cut to what Discord accepts. It also exports
discord.js's own formatters, so a bot imports its formatting from one place.

## When to use it

Use them wherever a reply shows a reader something to act on: the command to run next, how long to wait, the permission
they lack, or a text longer than one message. Each one that writes words, `formatDuration` and `permissionNames`, writes
them through your app's translator, so the reader sees them in their language without a catalog key of your own.

## Example

::example{file="formatting/status.slash.controller.ts" region="mention"}

`commandMention` gives `</settings notify email:1234567890123456789>`, which Discord shows as the command's name and
runs when clicked. The path is the command as a user types it: its name, then its subcommand group and subcommand.

## How it works

`commandMention(path, target)` looks the command up where the reader can use it: the server the target is in first, then
the global commands. The target is the interaction, message, server or client the mention is shown with. The IDs come
from the bot's own registration, or from one request per scope on its first mention, so it works in a shard, with
`commands.register: false`, and for commands `meocord register` sent.

A path your app doesn't declare throws a `RangeError`. A command that isn't registered where the reader is, or a mention
made before the bot is ready, throws an `Error` that says what to do.

## Writing a duration

::example{file="formatting/status.slash.controller.ts" region="duration"}

`formatDuration(ms, target?, options?)` writes `1h 5m` by default, and `1 hour, 5 minutes` with `{ style: 'long' }`.
Given an interaction, it writes in that user's language, and given a message, in its server's, through your app's
translator. Given a `Locale`, it writes in that language with `options.t` as the translator.

It shows two units, largest first, from days down to seconds. `units`, `largest`, `smallest` and `round` choose others:
`{ units: Infinity, smallest: 'ms' }` writes every unit down to milliseconds. A unit whose count is 0 is left out, and a
value that rounds to 0 reads `0s`.

`{ style: 'param' }` writes `1h30m`, which a [`{x:duration}` param](guide:message-params) reads back as the same value,
so a usage hint can show a value the command takes.

## Naming permissions

::example{file="formatting/permissions.guard.ts" region="guard"}

::example{file="formatting/status.slash.controller.ts" region="permissions"}

`permissionNames(permissions, target?, options?)` names permissions as a server owner reads them in Discord's role
settings: `ManageMessages` is `Manage Messages`. They come in bit order, one label per bit. `{ join: 'and' }` joins them
into one sentence part, `Ban Members and Manage Messages`, as the reader's language writes a list; `{ join: 'or' }`
joins them with its `or`. Without `join`, it returns the labels as an array.

It takes what discord.js reads as permissions: a flag name, a bigint, a `PermissionsBitField`, or an array of them, as
`memberPermissions.missing()` returns.

## Splitting a long message

::example{file="formatting/status.slash.controller.ts" region="split"}

`splitMessage(text)` splits text into messages of at most 2000 characters, or the `max` you give it. It cuts at a line
end, a line longer than a message at its last whitespace, and never through an emoji or an accented letter. It reads
code as Discord does: code cut across messages is closed at the end of one and reopened in the next, a code block with
its language and inline code with its own backticks, so each message shows its part as the whole text does.

An empty text gives `[]`, so check for a first part before you send it.

## Fitting a field

::example{file="formatting/status.slash.controller.ts" region="truncate"}

`truncate(text, max)` shortens text to `max` characters with an ellipsis, closing any code it cuts open; text that fits
comes back unchanged. `DiscordLimits` names Discord's length limits, such as `DiscordLimits.content`,
`DiscordLimits.embedDescription` and `DiscordLimits.customId`, so the number in your code says what it limits.

## discord.js's formatters

::example{file="formatting/status.slash.controller.ts" region="formatters"}

`meocord/common` exports discord.js's formatters under their own names: `userMention`, `channelMention`, `roleMention`,
`time` with `TimestampStyles`, `bold`, `codeBlock`, `escapeMarkdown` and the rest. They are your own discord.js's
functions, not copies, so code that imports them from discord.js keeps working, and their documentation is
[discord.js's](https://discord.js.org/docs/packages/formatters/stable).

## Testing it

::example{file="formatting/status.slash.controller.spec.ts" region="mention"}

In a testing module, `commandMention` answers from the commands the module's controllers declare, with a fixed ID per
command and no request. `overrideCommandId(name, id)` sets the ID a test expects. The module must declare the command
the mention names, so add its controller.

## Gotchas

- **`commandMention` is async.** It may list a scope's commands on its first mention, so await it before you build the
  reply.
- **A command registered in one server isn't mentioned in another.** The mention resolves only where the reader can run
  the command; elsewhere it throws.
- **`formatDuration` takes milliseconds.** `process.uptime()` and many APIs give seconds; multiply by 1000.
- **`splitMessage` sends nothing.** Send the first part as the reply and the rest as follow-ups, as the example does.

## Next steps

- [Localisation](guide:localisation): translate the unit words and permission labels, MeoCord's own texts in
  `meocord.duration` and `meocord.permissions`.
- [Responses](guide:responses): send the parts as a reply and its follow-ups.
- [Guards](guide:guards): refuse a call, and say why.
