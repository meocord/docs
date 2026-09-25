---
id: install-contexts
title: Where the interaction happened
section: Answering Discord
order: 22
since: 4.1.0
---

An app can be installed to a server, or by a user to their account. A user-installed app's commands work in
servers the bot is not in, and in direct messages between users, where the bot cannot see or post to the
channel. A command can run in four places:

| Where                                   | `where`             | `botInstalled` |
| --------------------------------------- | ------------------- | -------------- |
| A server that installed the app         | `'guild'`           | `true`         |
| Another server, through a user install  | `'guild'`           | `false`        |
| A direct message with the bot           | `'bot-dm'`          | `true`         |
| A direct or group message between users | `'private-channel'` | `false`        |

`respond()` answers through the interaction's own methods, which work in all four. It turns to the channel
only after the interaction's fifteen-minute token has expired, and only where the bot is present. Only edits
can take that path, so after fifteen minutes an error can be logged but no longer shown privately; a public
message is put back without one. A token error from fourteen minutes on counts as expired, to allow for a
clock running late.

`getInstallContext(interaction)` reports the same thing to your code:

::example{file="controllers/slash/stats.slash.controller.ts" region="where"}

In a test, mock interactions take `context` and `authorizingIntegrationOwners`, the map Discord sends, to put
a command in each of the four places:

::example{file="controllers/slash/stats.slash.controller.spec.ts" region="contexts"}

`botInstalled` says whether the bot is present, which is what decides whether the channel API is reachable.
It says nothing about the bot's permissions in that channel.
