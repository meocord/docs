---
id: subcommands
title: Subcommands
chapter: interactions
order: 2
summary: Give each subcommand of a slash command its own handler, named by the path Discord displays.
learn:
  - Describe subcommands and groups in one builder
  - Handle each subcommand in its own method
  - Know which handler a subcommand falls back to
requires: [slash-commands]
api: [decorators/Command, decorators/CommandBuilder]
since: 4.0.0
---

A slash command can hold subcommands, `/settings notify email`, and group them, as `notify` groups `email` there.
Discord sends the whole thing as one interaction named `settings`. MeoCord routes it on the full path instead, so
each subcommand gets a method of its own.

## When to use it

Use subcommands when several actions belong under one name: `/ticket open`, `/ticket close` and `/ticket list` read
as one feature, and share one entry in Discord's command list. Discord allows up to 25 subcommands or groups in a
command, 25 subcommands in each group, and one level of groups.

For actions that don't share a theme, separate [slash commands](guide:slash-commands) are easier to find. For a
choice between a few values of one action, a string option with choices is simpler than a subcommand per value.

## Example

The builder describes the command once, its groups and subcommands included:

::example{file="controllers/slash/builders/settings.builder.ts" region="builder"}

::example{file="controllers/slash/settings.slash.controller.ts" region="controller"}

`settings` carries the builder. Once a command has subcommands, Discord doesn't let a member run `/settings` alone, so
its handler runs only for a subcommand no method claims; here `notify email` has its own. `notifyEmail` handles
`/settings notify email`: its name is the path, with spaces between the parts as Discord displays them, and it
receives that subcommand's `enabled` option.

## How it works

When a command arrives, MeoCord tries its full path first, `settings notify email`, then the command's own name,
`settings`. The first handler that matches runs, through the full [pipeline](guide:how-a-call-runs).

- **One builder per command.** A subcommand handler takes `CommandType.SLASH` and no builder, since the parent's
  builder already describes every subcommand.
- **Options are flattened.** A subcommand handler receives its own options, `{ enabled }`, not the subcommand around
  them.
- **A subcommand no method claims** falls back to the command's own handler, which can list the choices or answer
  that the subcommand isn't supported yet.
- **A group is never skipped.** `settings notify email` doesn't fall back to `settings email`, since another group
  could declare its own `email`.

## Guards and cooldowns per subcommand

Each subcommand handler is a method like any other, so its guards, cooldowns and `@Defer` are its own. Put a staff
guard on `/ticket close` alone, or a cooldown on `/ticket open`, without touching the rest.

A guard on the controller applies to every subcommand it handles. See [Guards](guide:guards).

## Autocomplete in a subcommand

An option inside a subcommand is autocompleted by the subcommand's path and the option's name. See
[Autocomplete](guide:autocomplete).

## Gotchas

- **A subcommand handler with a builder stops the bot.** The builder is asked to build a command named by the path,
  `settings notify email`, and discord.js refuses the spaces, so the controller fails to load with
  `the builder SettingsCommandBuilder is declared on "settings notify email", which is a subcommand path…`, which says
  to declare the handler with `CommandType.SLASH`. A builder that sets the name `settings` itself is registered once,
  with a warning that the builder of `settings` describes the path. Give subcommand handlers `CommandType.SLASH`.
- **A typo in the path.** `@Command('settings notfy email', …)` never matches, so the command's own handler runs
  instead. The bot warns as it starts that the path is not a subcommand its builder registers. Test each path with
  `invoke` too, which refuses a path its handler doesn't handle.

## Next steps

- [Components](guide:components): buttons, select menus and forms.
- [Autocomplete](guide:autocomplete): suggestions for a subcommand's options.
- [Invoke and dispatch](guide:invoke-and-dispatch): testing each path.
