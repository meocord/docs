---
id: reactions
title: Reactions and other messages
chapter: messages
order: 3
summary: Run a handler when a reaction is added or removed, or for every message a user sends.
learn:
  - Handle one emoji, a custom emoji, or every reaction
  - Tell an added reaction from a removed one, and who reacted
  - Run a listener on every message, beside message commands
requires: [message-commands]
api: [decorators/ReactionHandler, types/ReactionEvent, types/ReactionHandlerSettings, types/ReactionHandlerAction]
since: 4.1.0
---

`@ReactionHandler('⭐')` runs when someone adds or removes a ⭐ on a message. `@MessageHandler()` with no
pattern runs for every message a user sends. Both are controller methods with guards, interceptors and filters,
like any other handler.

## When to use it

Use a reaction handler to act on reactions: a starboard, a poll, a role menu, or approving something with ✅.
For clicks, buttons are usually better: each click has a customId and gets an answer. See
[Buttons, selects and modals](guide:components).

Use a listener, `@MessageHandler()`, for work on all chat, such as logging, auto-moderation or counting
activity. For a command a user types, give `@MessageHandler` a pattern, as in
[Message commands](guide:message-commands).

## Example

::playground{file="controllers/reaction/star.reaction.controller.ts" region="controller" dispatch="reaction ⭐ on 'Ship it'"}

The second argument, a [`ReactionEvent`](api:types/ReactionEvent), says who reacted, `user`, and whether the reaction
was added or removed, `action`.

## How it works

1. **Match.** A reaction's emoji is compared with each handler's. Every handler that matches runs: in each
   controller, those for the emoji first, then those for every emoji.
2. **Fetch.** `reaction.message` is the copy of the message the gateway keeps current. When the bot holds the message
   only by its id, as for one sent before it started, MeoCord fetches it before your handlers run, so it is complete.
   A reaction that arrives without its count, with `Partials.Reaction`, is fetched too, so `reaction.count` is a
   number. The cached copy can lag Discord only rarely: after a reconnect that could not resume, which misses the edits
   made meanwhile, or for a poll's counts when the bot lacks the `GuildMessagePolls` intent. A handler that needs the
   message straight from Discord calls `await reaction.message.fetch()` itself. A reaction to a message the bot can no
   longer read, deleted or in a channel it lost access to, is skipped.
3. **Pipeline.** Each handler's [guards](guide:guards), interceptors and [filters](guide:exception-filters)
   run around it, as they do for a command.

Reactions from bots, the bot's own included, reach no handler, as messages from bots don't. A bot that seeds a
poll with its own reactions doesn't count them as votes, and never answers itself.

## Which emoji

| Write                    | Matches                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `'👍'`                   | That standard emoji, by its character                                |
| `'1234567890123456789'`  | That one custom emoji, by its id                                     |
| `'<:party:1234567890…>'` | The same, as Discord shows it when you send `\:party:`               |
| `'party'`                | Every custom emoji named `party`, one from each server the bot is in |
| nothing                  | Every reaction                                                       |

Use a custom emoji's id when the bot is in more than one server, so another server's `party` doesn't count.

## Added and removed

`action` is [`ReactionHandlerAction.ADD`](api:types/ReactionHandlerAction) or `REMOVE`. A handler that only
cares about one returns early for the other, as the example does. `user` is who added or removed it.

## Bots' reactions

A handler that wants bots' reactions sets `bots: true`:

::example{file="controllers/reaction/pin.reaction.controller.ts" region="bots"}

A user discord.js holds only in part is fetched to tell whether it is a bot, and the reaction is skipped if
that fails.

## Every message

`@MessageHandler()` with no pattern is a listener. It runs for every message a user sends, after the one
patterned handler the message matched, if any:

::playground{file="controllers/message/keyword.message.controller.ts" region="controller" dispatch="message ping"}

- It never runs for a message from a bot, or for one with no text.
- Its guards only filter what it takes. A denial gets no reply, and is logged at debug level.
- It reads the message's text, so the bot needs the `MessageContent` intent, as the gotchas below
  explain.

## Testing

`module.invoke` runs one handler with the arguments dispatch would pass. For a reaction, those are the
reaction and its options:

::example{file="controllers/reaction/star.reaction.controller.spec.ts" region="spec"}

`module.dispatch(reaction, { user, action })` sends the reaction through matching and every handler, as the
bot does.

## Gotchas

- **Nothing runs.** Reactions need the `GuildMessageReactions` intent, or `DirectMessageReactions` in DMs.
  For reactions on messages sent before the bot started, add the `Message` and `Reaction` partials.
- **A reaction in a DM.** It needs `DirectMessageReactions` and the `Channel` partial. Since discord.js 14.26.2,
  discord.js drops a reaction in a DM channel it has not cached, because Discord's reaction event names the channel by
  its id alone, with no type. MeoCord fetches that channel once, on its first reaction, and delivers the reaction to
  your handlers and to any `messageReactionAdd` or `messageReactionRemove` listener of your own. Later reactions in
  that DM need no request. One window remains: a DM reaction that arrives before the bot is ready, in the seconds
  while discord.js waits for its servers, is still dropped.
- **A listener gets empty text.** Without `MessageContent`, Discord sends a message's text only when it
  mentions the bot, is in a DM, or was sent by the bot. Enable the intent in `clientOptions` and in the
  developer portal.
- **A name matches too much.** `'party'` matches a `party` emoji from every server. Use the id.

## Build it

When the bot files feedback from chat it replies `Filed as feedback #3`. Staff can decide it by reacting to that
reply: ✅ approves, ❌ rejects.

::example{file="tutorial/review.reaction.controller.ts" region="reactions"}

The handler acts only on an added reaction, only on a reply of the bot's that names feedback, where it reads the
feedback's number, and only for a member holding the staff role from `FeedbackSettings`; anyone else's reaction
changes nothing. A status reply names feedback too, so staff can decide from either; one naming feedback the bot
doesn't hold, such as `There is no feedback #9.`, decides nothing. In the app, add the controller, the
`GuildMessageReactions` intent, and the `Message` and `Reaction` partials, so reactions to replies sent before
the bot restarted still arrive:

::example{file="tutorial/app.ts" region="app"}

## Next steps

- [Gateway events](guide:gateway-events): handle members joining, and any other client event.
- [Guards](guide:guards): decide who may run a command, and tell them why not.
- [Invoke and dispatch](guide:invoke-and-dispatch): test a reaction end to end.
