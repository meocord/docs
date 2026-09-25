---
id: subcommands
title: 'Subcommands'
order: 9
source: readme@4.0.0
---

Discord sends `/settings notify email` as a single interaction named `settings`, so a command with subcommands would otherwise have one handler for all of them. Name the full path — parts separated by a space, the way Discord displays them — to give each subcommand its own method:

```typescript
@Controller()
export class SettingsController {
  // The builder is declared once, on the command itself.
  @Command('settings', SettingsCommandBuilder)
  async settings(interaction: ChatInputCommandInteraction) {
    await interaction.reply('Pick a subcommand.')
  }

  @Command('settings notify email', CommandType.SLASH)
  async notifyEmail(interaction: ChatInputCommandInteraction, { enabled }) {
    await interaction.reply(`Email notifications ${enabled ? 'on' : 'off'}`)
  }
}
```

Subcommand handlers take the plain `CommandType.SLASH` and no builder: the subcommand is already described by the parent's builder, and registering a second command for it would be rejected by Discord. Options are flattened, so `notifyEmail` receives `{ enabled }` rather than the wrapping subcommand.

The full path is always tried before the bare command name, whatever order the controllers were registered in, and a subcommand nobody claimed falls back to the command's own handler. A group is never dropped on the way down — `settings notify email` does not fall back to `settings email`, because another group could declare its own `email`.

---
