---
id: install-contexts
title: Where the interaction happened
chapter: interactions
order: 9
summary: Tell a server install from a user install, and a server from a DM, and answer each the way it allows.
learn:
  - Read where a command was used with getInstallContext
  - Know what respond() can do in each of the four places
  - Test a command in each place
requires: [slash-commands, responses]
api: [utilities/getInstallContext]
since: 4.1.0
---

An app can be installed to a server, or by a member to their own account. A user-installed app's commands follow the
member everywhere: into servers the bot isn't in, and into DMs and group DMs between users, where the bot can't see
or post to the channel.

So a command can run in four places, and what the bot can do differs between them.

## When to use it

Read where a command ran when the answer should depend on it: keep an answer private in a server the bot isn't in,
refuse a server-only feature in a DM, or skip posting to a channel the bot can't reach.

If your app is only installed to servers, every command runs where the bot is present, and you rarely need this.
`respond()` already answers correctly in all four places without your help.

## Example

::example{file="controllers/slash/stats.slash.controller.ts" region="where"}

[`getInstallContext(interaction)`](api:utilities/getInstallContext) reports where the command ran and whether the bot
is there. In a server that only a member's own install reaches, the answer stays private.

## How it works

`getInstallContext` reads the interaction's `context` and `authorizingIntegrationOwners`, which Discord sends with
every interaction:

| Where                                   | `where`             | `botInstalled` |
| --------------------------------------- | ------------------- | -------------- |
| A server that installed the app         | `'guild'`           | `true`         |
| Another server, through a user install  | `'guild'`           | `false`        |
| A direct message with the bot           | `'bot-dm'`          | `true`         |
| A direct or group message between users | `'private-channel'` | `false`        |

`botInstalled` says whether the bot is present, which decides whether the channel API is reachable. It says nothing
about the bot's permissions in that channel.

## What respond() can do in each place

`respond()` answers through the interaction's own methods, which work in all four places. It turns to the channel
only after the interaction's fifteen-minute token has expired, and only where the bot is present:

- **Within fifteen minutes**, everywhere: replies, updates, edits and follow-ups.
- **After fifteen minutes**, where the bot is present: only edits, sent through the channel. An error can be logged
  but no longer shown privately.
- **After fifteen minutes**, where it isn't: nothing more can be sent, and the reason is logged.

A token error from fourteen minutes on counts as expired, to allow for a clock running late.

## Letting a command run in more places

A builder chooses where its command can be installed and used, with discord.js's `setIntegrationTypes` and
`setContexts`. A command installable to a user and usable in DMs between users reaches `'private-channel'`:
everything it does has to go through the interaction.

## Testing

Mock interactions take `context` and `authorizingIntegrationOwners`, the map Discord sends, to put a command in each
of the four places:

::example{file="controllers/slash/stats.slash.controller.spec.ts" region="contexts"}

## Gotchas

- **Posting to the channel where the bot isn't.** `interaction.channel.send` fails in a server the bot isn't in and
  in DMs between users. Answer through `respond()`, or check `botInstalled` first.
- **A long job outliving its token.** Past fifteen minutes, only edits reach the member, and only where the bot is
  present. Send progress early, or DM the result.
- **`botInstalled` isn't permission.** The bot can be present and still lack Send Messages in that channel.

## Next steps

- [Answering with respond()](guide:responses): the answers it chooses.
- [Context menus](guide:context-menus): commands that often run in DMs.
- [Mocks](guide:mocks#overrides): setting where a mock interaction ran.
