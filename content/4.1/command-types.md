---
id: command-types
title: Commands and components
section: Core
order: 12
---

`@Command(name, type)` binds a controller method to one kind of interaction, and the type decides which
discord.js interaction the method receives. For a command Discord knows about, the second argument is the
builder class instead, whose type is the one it was declared with.

| `CommandType`             | The handler receives                                                          | Routed by  |
| ------------------------- | ----------------------------------------------------------------------------- | ---------- |
| `SLASH`                   | `ChatInputCommandInteraction`                                                 | name       |
| `CONTEXT_MENU`            | `UserContextMenuCommandInteraction` or `MessageContextMenuCommandInteraction` | name       |
| `PRIMARY_ENTRY_POINT`     | `PrimaryEntryPointCommandInteraction`                                         | name       |
| `BUTTON`                  | `ButtonInteraction`                                                           | `customId` |
| `SELECT_MENU`             | `StringSelectMenuInteraction`                                                 | `customId` |
| `USER_SELECT_MENU`        | `UserSelectMenuInteraction`                                                   | `customId` |
| `ROLE_SELECT_MENU`        | `RoleSelectMenuInteraction`                                                   | `customId` |
| `MENTIONABLE_SELECT_MENU` | `MentionableSelectMenuInteraction`                                            | `customId` |
| `CHANNEL_SELECT_MENU`     | `ChannelSelectMenuInteraction`                                                | `customId` |
| `MODAL_SUBMIT`            | `ModalSubmitInteraction`                                                      | `customId` |

Autocomplete has [its own decorator](/docs/4.1/autocomplete), since it registers nothing and is answered
with suggestions rather than a reply. Messages and reactions have `@MessageHandler` and `@ReactionHandler`.

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
