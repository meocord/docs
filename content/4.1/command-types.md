---
id: command-types
title: Commands and components
section: Core
order: 12
---

`@Command(name, type)` binds a controller method to one kind of interaction, and the type decides which
discord.js interaction the method receives. For a command Discord knows about, the second argument is the
builder class instead, whose type is the one it was declared with.

| `CommandType`             | The handler receives                                                                                    | Routed by  |
| ------------------------- | ------------------------------------------------------------------------------------------------------- | ---------- |
| `SLASH`                   | `ChatInputCommandInteraction`                                                                           | name       |
| `CONTEXT_MENU`            | `UserContextMenuCommandInteraction` or `MessageContextMenuCommandInteraction`, as its builder registers | name       |
| `PRIMARY_ENTRY_POINT`     | `PrimaryEntryPointCommandInteraction`                                                                   | name       |
| `BUTTON`                  | `ButtonInteraction`                                                                                     | `customId` |
| `SELECT_MENU`             | `StringSelectMenuInteraction`                                                                           | `customId` |
| `USER_SELECT_MENU`        | `UserSelectMenuInteraction`                                                                             | `customId` |
| `ROLE_SELECT_MENU`        | `RoleSelectMenuInteraction`                                                                             | `customId` |
| `MENTIONABLE_SELECT_MENU` | `MentionableSelectMenuInteraction`                                                                      | `customId` |
| `CHANNEL_SELECT_MENU`     | `ChannelSelectMenuInteraction`                                                                          | `customId` |
| `MODAL_SUBMIT`            | `ModalSubmitInteraction`                                                                                | `customId` |

Autocomplete has [its own decorator](/docs/4.1/autocomplete), since it registers nothing and is answered
with suggestions rather than a reply. Messages and reactions have `@MessageHandler` and `@ReactionHandler`.

## Context menu handlers

A context menu handler declares the kind of interaction its builder registers: `UserContextMenuCommandInteraction`
for a builder that sets `ApplicationCommandType.User`, and `MessageContextMenuCommandInteraction` for `Message`:

::example{file="controllers/context-menu/builders/report.builder.ts" region="builder"}

::example{file="controllers/context-menu/report.context-menu.controller.ts" region="user"}

- **The kind is checked as the bot starts.** A builder's kind is a value the compiler can't read, so a handler that
  declares the other kind stops the bot, naming the handler and the builder.
- **A handler for both kinds** takes their union, and narrows it with `isUserContextMenuCommand()` or
  `isMessageContextMenuCommand()`.
- **A user command and a message command may share a name,** as Discord allows, and each reaches its own handler.
- **`meocord g co context-menu Report`** generates a user command with its handler typed to match, and `--message`
  a message one.

A mock gets its target in the overrides, since discord.js makes `targetUser` and `targetMessage` read-only:

::example{file="controllers/context-menu/report.context-menu.controller.spec.ts" region="spec"}

## Select menus

The four entity select menus are separate types because Discord sends them as separate component types,
with different resolved data. A user select menu's handler receives the users picked:

::example{file="controllers/select-menu/assign.select-menu.controller.ts" region="user-select"}

Declaring `SELECT_MENU` for it is a type error rather than a silent mismatch. Components route on their
`customId`, and `{taskId}` captures part of it: see [Routing components](/docs/4.1/component-routing).

## Slash command options

A slash handler's second argument holds the options the command was run with, keyed by name. User, role,
channel and attachment options arrive resolved, a `User` rather than its id:

::example{file="controllers/slash/kick.slash.controller.ts" region="options"}

## Entry point commands

An activity's entry point has no builder class in discord.js, so its builder returns the command's REST body
itself:

::example{file="controllers/context-menu/builders/launch.builder.ts" region="builder"}

Its `handler` is `EntryPointCommandHandlerType.AppHandler`, so Discord sends the interaction to the bot, where
`@Command('launch', LaunchCommandBuilder)` handles it. With `DiscordLaunchActivity`, Discord launches the activity
itself and the bot receives nothing.
