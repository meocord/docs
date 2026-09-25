---
id: messages-and-reactions
title: Messages and reactions
section: Beyond commands
order: 50
since: 4.1.0
---

Besides interactions, a controller can handle ordinary messages with `@MessageHandler` and reactions with
`@ReactionHandler`. Neither registers anything with Discord, which is why neither is a `CommandType`.

## Messages

`@MessageHandler(keyword)` runs when a message's whole content, trimmed, is exactly the keyword; the match is
case-sensitive, so stack two decorators for two spellings. `@MessageHandler()` with no keyword runs for every
message:

::example{file="controllers/message/keyword.message.controller.ts" region="controller"}

- Messages from bots, the bot's own among them, and messages with no text are skipped.
- In each controller, the keyword handlers run before the ones for every message, one after another.
- The handler receives the discord.js `Message`, and answers it with `message.reply()` or
  `message.channel.send()`; `respond()` is for interactions.

## Reactions

`@ReactionHandler(emoji)` runs when that emoji is added to or removed from a message, and
`@ReactionHandler()` for every emoji. The emoji is matched by name: the character for a standard emoji, the
name for a custom one. The second argument says who reacted, and whether the reaction was added or removed:

::example{file="controllers/reaction/star.reaction.controller.ts" region="controller"}

Before a reaction handler runs, the reacted-to message is fetched, so `reaction.message` is complete even for
a message sent before the bot started. A reaction on a message the bot can no longer read, deleted or in a
channel it lost access to, is skipped.

## Intents

Both need intents in `clientOptions`, and reactions on older messages need partials:

- `@MessageHandler`: `GuildMessages` (or `DirectMessages`), and `MessageContent`, which is privileged and is
  also enabled in the Discord developer portal.
- `@ReactionHandler`: `GuildMessageReactions` (or `DirectMessageReactions`), with the `Message` and
  `Reaction` partials.

::example{file="app-beyond-commands.ts" region="app"}

At startup, MeoCord warns once for each intent or partial a handler needs that `clientOptions` lacks.

## Guards, interceptors and filters

Message and reaction handlers run through [the same pipeline](/docs/4.1/how-a-handler-runs) as commands:
`@UseGuard`, `@UseInterceptor` and `@UseFilter`, and the app's global ones, apply. A guard receives the
message, or the reaction and its options, and `ExecutionContext.getType()` is `'message'` or `'reaction'`. A
global guard written for interactions declares `@Guard({ types: ['interaction'] })` to skip them; see
[Guards](/docs/4.1/guards).

## Testing

`invoke` runs a message or reaction handler with the arguments dispatch passes:

::example{file="controllers/message/keyword.message.controller.spec.ts" region="spec"}

::example{file="controllers/reaction/star.reaction.controller.spec.ts" region="spec"}
