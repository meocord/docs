---
id: command-types
title: "Command Types"
order: 7
source: readme@4.0.0
---

`@Command` binds a method to one kind of interaction, and the interaction class the handler receives follows from that. Every type Discord sends is covered.

| `CommandType`             | Handler receives                                                            | Routed by  |
| ------------------------- | --------------------------------------------------------------------------- | ---------- |
| `SLASH`                   | `ChatInputCommandInteraction`                                               | name       |
| `CONTEXT_MENU`            | `UserContextMenuCommandInteraction \| MessageContextMenuCommandInteraction` | name       |
| `PRIMARY_ENTRY_POINT`     | `PrimaryEntryPointCommandInteraction`                                       | name       |
| `BUTTON`                  | `ButtonInteraction`                                                         | `customId` |
| `SELECT_MENU`             | `StringSelectMenuInteraction`                                               | `customId` |
| `USER_SELECT_MENU`        | `UserSelectMenuInteraction`                                                 | `customId` |
| `ROLE_SELECT_MENU`        | `RoleSelectMenuInteraction`                                                 | `customId` |
| `MENTIONABLE_SELECT_MENU` | `MentionableSelectMenuInteraction`                                          | `customId` |
| `CHANNEL_SELECT_MENU`     | `ChannelSelectMenuInteraction`                                              | `customId` |
| `MODAL_SUBMIT`            | `ModalSubmitInteraction`                                                    | `customId` |

Autocomplete has its own decorator — see [Autocomplete](/docs/4.0/autocomplete#autocomplete). It has no `CommandType` member, because it registers nothing and is answered with `respond()` rather than a reply. `@MessageHandler` and `@ReactionHandler` are outside `CommandType` for the same reason: `CommandType` is the set of things `@Command` can bind to, not the set of things MeoCord handles.

The kebab-case `ControllerType` used by the CLI is a wider list — it names every kind of controller that can be scaffolded, including the three that are not commands.

The four entity select menus are separate types because Discord sends them as separate component types carrying different resolved data. Declaring `SELECT_MENU` for a user select menu is a type error, not a silent mismatch:

```typescript
@Command('assign/{taskId}', CommandType.USER_SELECT_MENU)
async assign(interaction: UserSelectMenuInteraction, { taskId }) {
  await interaction.reply(`Assigned to ${interaction.users.map(user => user.username).join(', ')}`)
}
```

### Slash command options

A slash handler's second argument holds the options the command was invoked with, keyed by name. Entity options arrive resolved — a `User`, `Role`, `GuildChannel` or `Attachment`, not the snowflake:

```typescript
@Command('kick', KickCommandBuilder)
async kick(interaction: ChatInputCommandInteraction, { target, reason }) {
  // target is a User, reason is a string
  await interaction.reply(`Kicked ${target.username}: ${reason}`)
}
```

### Entry point commands

Activity entry points have no builder class in `@discordjs/builders`, so their builder returns the REST body directly. `handler: AppHandler` is what makes Discord send the interaction to the bot at all:

```typescript
@CommandBuilder(CommandType.PRIMARY_ENTRY_POINT)
export class LaunchCommandBuilder {
  build() {
    return {
      type: ApplicationCommandType.PrimaryEntryPoint as const,
      name: 'launch',
      description: 'Launch the activity',
      handler: EntryPointCommandHandlerType.AppHandler,
    }
  }
}
```

---
