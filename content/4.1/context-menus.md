---
id: context-menus
title: Context menus
chapter: interactions
order: 5
summary: Add a command to the Apps menu of a user or a message, and handle it like a slash command.
learn:
  - Describe a user or message command with a builder
  - Read the user or message the menu was opened on
  - Test a context menu command with its target
requires: [slash-commands]
api: [decorators/Command, decorators/CommandBuilder]
since: 4.0.0
covers: [4.0/command-types]
---

A context menu command appears when a member right-clicks a user or a message and opens **Apps**: "Report user",
"Bookmark", "Translate". It takes no options. What it acts on is the user or message the menu was opened on, which
the interaction carries as its target.

## When to use it

Use a context menu when a command's subject is a particular user or message, and picking it by right-click is more
natural than pasting an id: reporting a message, bookmarking it, looking up a member's profile.

When the member has to type something, such as a reason or an amount, a [slash command](guide:slash-commands) with
options fits better, or a context menu that opens a form with `respond(interaction).modal(...)`.

## Example

A user command's builder, with its type set to `User`:

::example{file="controllers/context-menu/builders/report.builder.ts" region="builder"}

::example{file="controllers/context-menu/report.context-menu.controller.ts" region="user"}

"Report user" appears in a member's **Apps** menu. The handler reads the member it was opened on from
`interaction.targetUser`, and thanks the reporter privately.

## How it works

A context menu command is registered and routed like a slash command:

- **The builder** returns a `ContextMenuCommandBuilder`, with its type `User` or `Message`, under
  `@CommandBuilder(CommandType.CONTEXT_MENU)`. [Registering commands](guide:slash-commands#registering-commands)
  applies as it does to slash commands.
- **The name is what the menu shows.** Unlike a slash command's, it may hold capitals and spaces, and `@Command`
  takes it as it is: `@Command('Report user', ReportUserBuilder)`. A user command and a message command may share a
  name, since Discord keeps them apart by type, and each reaches its own handler.
- **The handler receives** a `UserContextMenuCommandInteraction` or a `MessageContextMenuCommandInteraction`, and no
  options. It runs through the full [pipeline](guide:how-a-call-runs) and answers with `respond()`.

## Message commands

A message command's builder sets the type `Message`, and its handler reads `interaction.targetMessage`:

::example{file="controllers/context-menu/report.context-menu.controller.ts" region="message"}

## The handler's type

A handler declares the kind of interaction its builder registers: `UserContextMenuCommandInteraction` for a builder that
sets `ApplicationCommandType.User`, and `MessageContextMenuCommandInteraction` for `Message`, as the examples do.
MeoCord reads the kind from the builder's `setType()`, so a handler that declares the other kind doesn't compile,
however its interaction is imported. The error is on its `@Command`: "Unable to resolve signature of method decorator
when called as an expression".

A builder whose kind the compiler can't tell, one whose `build()` declares its return type as
`ContextMenuCommandBuilder` or that picks the kind at runtime, lets its handler declare either. MeoCord then checks the
kind as the controller loads: a handler of the other kind stops the bot, naming the handler and the builder. That check
reads the decorator metadata the compiler emits, so it needs the interaction class imported as a value, as the generated
controller does; `import { type … }` erases it.

A handler that serves both kinds takes their union, and narrows it with `isUserContextMenuCommand()` or
`isMessageContextMenuCommand()`. `meocord g co context-menu Report` generates a user command with its handler typed to
match, and `--message` a message one.

## Testing

Give the mock its target in the overrides, since discord.js makes `targetUser` and `targetMessage` read-only:

::example{file="controllers/context-menu/report.context-menu.controller.spec.ts" region="spec"}

## Gotchas

- **A menu the member can't find.** Context menu commands appear under **Apps** when right-clicking, not in the `/`
  list. Say so in your bot's help.
- **A handler typed for the other kind.** A handler declaring `MessageContextMenuCommandInteraction` on a builder that
  sets `User` doesn't compile. Match the handler to the builder's `setType()`.
- **A name mismatch.** The name in `@Command` is the one the builder receives. Build with `setName(commandName)`, so
  the menu and the handler can't disagree.
- **Replying in public by accident.** A report or a bookmark is usually for the member alone; send it with
  `MessageFlags.Ephemeral`.

## Next steps

- [Where the interaction happened](guide:install-contexts): servers, DMs and user installs.
- [Components](guide:components): the form a context menu can open.
- [Answering with respond()](guide:responses): private answers and follow-ups.
