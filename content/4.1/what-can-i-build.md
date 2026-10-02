---
id: what-can-i-build
title: What you can build
chapter: appendix
group: help
order: 1
summary: Every kind of handler MeoCord runs, from slash commands to gateway events, each with a small working example.
requires: [first-command]
api:
  [
    decorators/Command,
    decorators/CommandBuilder,
    decorators/Autocomplete,
    decorators/MessageHandler,
    decorators/ReactionHandler,
    decorators/On,
  ]
---

A MeoCord bot is controllers, and a controller's methods are its handlers. Each kind of handler answers one thing a
member does in Discord: runs a command, clicks a button, sends a message, reacts, or joins a server. Here is each kind,
with a small example that compiles and runs, and the page that teaches it.

## Slash commands

A member types `/echo` and picks its options. The builder describes the command Discord shows, and the handler
answers it:

::example{file="controllers/slash/echo.slash.controller.ts" region="builder"}

::example{file="controllers/slash/echo.slash.controller.ts" region="handler"}

[Slash commands](guide:slash-commands) covers options, registering and permissions.

## Subcommands

One command with groups and subcommands, such as `/settings notify email`, each routed to a handler of its own:

::example{file="controllers/slash/settings.slash.controller.ts" region="controller"}

[Subcommands](guide:subcommands) covers groups and the builder.

## Buttons

A button's custom ID carries what the handler needs, read back as typed params:

::example{file="controllers/button/profile.button.controller.ts" region="params"}

[Buttons, selects and modals](guide:components) covers patterns and routing.

## Select menus

A member picks values from a menu, and the handler gets them:

::example{file="controllers/select-menu/poll.select-menu.controller.ts" region="values"}

[Select menus](guide:components#select-menus) covers the user, role, channel and mentionable menus too.

## Modals

A form a member fills in and submits, routed by its custom ID:

::example{file="controllers/modal-submit/feedback.modal.controller.ts" region="modal"}

[Modals](guide:components#modals) covers opening one and reading its fields.

## Context menus

A member right-clicks a user or a message and picks the bot's command:

::example{file="controllers/context-menu/report.context-menu.controller.ts" region="user"}

[Context menus](guide:context-menus) covers message context menus and the builder.

## Autocomplete

The bot suggests values for an option as the member types it:

::example{file="controllers/slash/search.slash.controller.ts" region="controller"}

[Autocomplete](guide:autocomplete) covers where the suggestions come from and their limits.

## Message commands

A member sends `!roll 20 for initiative`, and the pattern and its schema hand the handler its values, typed:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

[Message commands](guide:message-commands) covers prefixes, flags, lists and aliases.

## Reactions

A member reacts to a message with an emoji, and the bot acts on it:

::example{file="controllers/reaction/star.reaction.controller.ts" region="controller"}

[Reactions and other messages](guide:reactions) covers removals and partial messages.

## Gateway events

Anything else Discord tells the bot, such as a member joining a server:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

[Gateway events](guide:gateway-events) covers every event and when a handler runs.

## Next steps

- [Your first command](guide:first-command): build one of these from scratch, and run it.
- [How a call runs](guide:how-a-call-runs): what happens between the member's click and your handler.
- [Services](guide:services): share state and work between handlers, injected where they're needed.
