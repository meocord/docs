---
id: slash-commands
title: Slash commands
chapter: interactions
order: 1
summary: Describe a slash command with a builder class, handle it with a controller method, and let MeoCord register it.
learn:
  - Describe a command and its options with a builder
  - Handle it, with its options as typed params
  - Choose where and when the commands are registered
requires: [first-command]
api: [decorators/Command, decorators/CommandBuilder, configuration/MeoCordConfig]
since: 4.0.0
formerly: [command-types, command-registration]
covers: [4.0/command-types]
---

A slash command is what a member types after `/` in Discord, with options Discord checks before your bot sees
anything. In MeoCord a command has two parts: a builder class that describes it to Discord, and a controller method
that handles it.

MeoCord registers the commands your builders describe when the bot starts, so what Discord shows and what your bot
handles come from the same code.

## When to use it

Use a slash command for an action a member starts on purpose: look something up, open a form, change a setting.
Discord lists it, completes its options and validates them, so it's the most discoverable way into a bot.

For an action on a particular user or message, a right-click is often better: see
[Context menus](guide:context-menus). For several related actions under one name, such as `/ticket open` and
`/ticket close`, use [Subcommands](guide:subcommands). To read commands from plain messages, such as `!roll 20`, use
[Message commands](guide:message-commands).

## Example

::example{file="controllers/slash/echo.slash.controller.ts" region="builder"}

::playground{file="controllers/slash/echo.slash.controller.ts" region="handler" dispatch="/echo text:'hi'"}

The builder describes `/echo` with one required text option. The controller method handles it: MeoCord hands it the
interaction, and the options the member typed, keyed by name. It answers privately with what they said.

## How it works

1. **As the controller loads**, `@Command` calls its builder's `build(commandName)` with the name it was given. Once
   the bot is ready, MeoCord registers the commands with Discord in one bulk update per scope.
2. **When a member runs one**, Discord sends a `ChatInputCommandInteraction`. MeoCord finds the handler by the
   command's name, and by its subcommand path when it has one.
3. **The handler runs** through the [pipeline](guide:how-a-call-runs): `@Defer`, guards, interceptors, validation
   and cooldowns, all inside its exception filters.
4. **It receives two arguments**: the interaction, and the options as an object. It answers with
   [`respond()`](guide:responses).

[`@Command(name, Builder)`](api:decorators/Command) takes the builder class for a command Discord knows about. The
builder's [`@CommandBuilder`](api:decorators/CommandBuilder) type decides which interaction the handler receives.

## Options

A handler's second argument holds the options the command was run with. User, role, channel and attachment options
arrive resolved, a `User` rather than its id:

::example{file="controllers/slash/kick.slash.controller.ts" region="options"}

An option the member left out is missing from the object, so type it as optional. To check a value beyond what Discord
checks, such as a range or a format, use [Validation](guide:validation).

## Registering commands

By default the commands are registered globally, on every start. `commands` in `meocord.config.ts` changes where, and
whether at startup:

::example{file="config/commands.meocord.config.ts" region="config"}

| Option             | Default | What it does                                                                                                                         |
| ------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `guilds`           | none    | Registers every command to these servers instead of globally. Unset or `[]` means global.                                            |
| `developmentGuild` | none    | Under `meocord start --dev`, every command goes to this server and nowhere else. Server commands show up at once.                    |
| `register`         | `true`  | Registers at startup. `false` leaves it to `meocord register`, run from CI for instance.                                             |
| `clearOther`       | `false` | Removes this application's commands from the scopes named here but not in use. Without it, such leftovers are reported as a warning. |

A `guilds` list whose ids are all blank, such as `[process.env.GUILD_ID]` with the variable unset, registers nothing
and warns, rather than publishing the commands globally.

Each scope gets one bulk update, which replaces what the application has there, so a command you remove disappears on
the next registration. A failed registration is logged, and the bot stays online.

### A command in its own servers

A builder's `guilds` option sends its command to those servers only, for staff commands, say:

::example{file="controllers/slash/builders/ban.builder.ts" region="builder"}

A builder whose list is empty, once blank ids are dropped, is registered nowhere, rather than published globally by
accident.

### Registering without starting

`meocord register` registers and exits without connecting to the gateway. It needs a build, which `--build` makes,
and the bot's token:

```bash
npx meocord register --build          # the production scope
npx meocord register --dev            # to commands.developmentGuild
npx meocord register --guild 1234567  # every command to one server
```

It exits with a non-zero code when it can't register every command, as when Discord rejects the token or the commands,
so a deploy step can stop on it.

## Entry point commands

An activity's entry point command has no builder class in discord.js, so its builder returns the command's REST body
itself, and its handler receives a `PrimaryEntryPointCommandInteraction`:

::example{file="controllers/context-menu/builders/launch.builder.ts" region="builder"}

Its `handler` decides who answers. With `EntryPointCommandHandlerType.AppHandler`, as here, Discord sends the
interaction to the bot, where `@Command('launch', LaunchCommandBuilder)` handles it. With
`EntryPointCommandHandlerType.DiscordLaunchActivity`, Discord launches the activity itself, and the bot receives
nothing.

## Gotchas

- **Old commands linger after you move scopes.** Going from global to server commands, or back, leaves the old ones
  behind, and Discord shows both. MeoCord warns about them; set `clearOther: true` to remove them. While
  `developmentGuild` receives every command they're only warned about, since development and production often share
  one application.
- **A command deleted outside the bot stays gone in development.** Under `start --dev`, a set of commands that hasn't
  changed since the last start isn't sent again, so one deleted through the API or another tool isn't restored. Start
  with `--force-register` to send the set again.
- **A handler without a matching command never runs.** The name in `@Command` is the name the builder receives, so
  build it with `setName(commandName)` rather than a second copy of the name. The bot warns at startup about such a
  handler, naming the name its builder registers, and in the next major version (5.0) it refuses to start.

## Build it

The feedback bot starts with one command, `/feedback`. Describe it with a builder:

::example{file="tutorial/feedback.builder.ts" region="builder"}

Handle it in the feedback controller, where it opens the form a member fills in:

::example{file="tutorial/feedback.controller.ts" region="open"}

`respond(interaction).modal()` shows a form built with discord.js's `ModalBuilder`, each text input set in a
`LabelBuilder` that gives it its label. Its `customId`, `feedback/submit`, is how the submission finds its handler,
which you'll write in [Components](guide:components#build-it). Add `FeedbackController` to the app's `controllers`, as
in [Your first command](guide:first-command).

Start the bot with `npx meocord start --dev` and run `/feedback` in your test server: the form opens.

## Next steps

- [Components](guide:components): buttons, select menus and the form `/feedback` opens.
- [Subcommands](guide:subcommands): several actions under one command.
- [Answering with respond()](guide:responses): replies, edits and follow-ups.
- [Autocomplete](guide:autocomplete): suggestions as a member types an option.
