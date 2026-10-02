---
id: sapphire
title: Coming from Sapphire
chapter: appendix
group: coming-from
order: 2
summary: One small bot written with Sapphire and with MeoCord, side by side, and what each piece becomes.
requires: [first-command]
api:
  [
    decorators/Command,
    decorators/CommandBuilder,
    decorators/MessageHandler,
    decorators/On,
    decorators/UseGuard,
    decorators/Cooldown,
    decorators/Catch,
  ]
formerly: [coming-from-sapphire]
---

Sapphire and MeoCord both sit on discord.js and both take the plumbing off your hands. They differ in shape. Sapphire
builds a bot from pieces, classes it loads from folders by convention. MeoCord builds it from decorated controllers
that an app class lists, with dependencies injected by constructor. This page shows one small bot both ways. The
Sapphire side is typechecked against `@sapphire/framework` 5.5.1.

## What maps to what

| In Sapphire                                        | In MeoCord                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A `Command` piece in `commands/`                   | A controller method with `@Command`, listed in the app class                                              |
| `registerApplicationCommands` and its registry     | A `@CommandBuilder` class                                                                                 |
| An `InteractionHandler` with `parse()` and `run()` | A method with a `customId` pattern such as `card/{ownerId}/refresh`                                       |
| `messageRun` and `Args`                            | A [message command](guide:message-commands) pattern, with typed params                                    |
| A precondition                                     | A [guard](guide:guards), for commands and components alike                                                |
| `cooldownLimit` and `cooldownDelay`                | [`@Cooldown`](guide:cooldowns)                                                                            |
| A listener for `chatInputCommandError`             | An [exception filter](guide:exception-filters), or the built-in fallback                                  |
| A listener for `messageCommandError`               | [`dmOnError` and `dmOnCooldown`](guide:message-commands#telling-the-author-privately), a DM to the author |
| A `Listener` piece in `listeners/`                 | [`@On`](guide:gateway-events) on a controller method                                                      |
| `container`, augmented with your own properties    | [Services](guide:services), injected by constructor                                                       |

## A slash command

A Sapphire command is a class that registers itself, reads its options from the interaction, and reaches shared
objects through the container:

::example{from="compare" file="sapphire/commands/greet.ts" region="command"}

::example{from="compare" file="sapphire/greeting.service.ts" region="service"}

In MeoCord, the builder is its own class, the options arrive as an argument, and the service is a constructor
parameter, typed by its class with no augmentation:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

::example{file="services/greeting.service.ts" region="service"}

## A button with an owner

In Sapphire a button is an interaction handler: `parse()` decides whether it takes the interaction, and `run()`
handles it. Preconditions guard commands, so the owner check sits in `run()`:

::example{from="compare" file="sapphire/interaction-handlers/refresh.ts" region="button"}

In MeoCord the pattern routes the click, and the owner check is a guard that any button can reuse:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

## Message commands

A Sapphire command handles messages with `messageRun`, reading each word from `Args` by type. The client loads the
message listeners only when asked, and takes the prefix:

::example{from="compare" file="sapphire/prefix.ts" region="client"}

::example{from="compare" file="sapphire/commands/roll.ts" region="command"}

In MeoCord a message command is a pattern. The app sets the prefix, a schema types each param, and a message that
leaves out a param gets the command's usage in reply, and one the schema refuses gets the reason:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

## Errors

Sapphire emits an error a command throws as an event, and its default listeners log it. A listener of your own decides
what the member is told:

::example{from="compare" file="sapphire/listeners/command-error.ts" region="listener"}

In MeoCord the [built-in fallback](guide:exception-filters#the-built-in-fallback) logs the error and tells the member
something went wrong: privately, or in the reply a public `@Defer` started. A message command's error is logged only,
unless the app turns on [`dmOnError`](guide:message-commands#telling-the-author-privately). An
[exception filter](guide:exception-filters) answers an error of its own type in its own words, on one handler, a
controller or the whole bot:

::example{file="filters/unknown-account.filter.ts" region="filter"}

## Events and startup

A Sapphire listener is a piece too, and the client finds it in `listeners/`:

::example{from="compare" file="sapphire/listeners/welcome.ts" region="listener"}

::example{from="compare" file="sapphire/main.ts" region="client"}

In MeoCord an event is a decorated method, and the app class lists what the bot is made of, so nothing is found by
its location:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app-beyond-commands.ts" region="app"}

## Testing

MeoCord runs a handler through the same pipeline the bot uses, guards and cooldowns included, with mocks of the
discord.js objects:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## What you gain

Translations and subcommands are built in: typed [catalogs](guide:localisation), where a key the default catalog lacks
or a param left out fails to compile, and [subcommand handlers](guide:subcommands) on the parent command's builder.
Guards apply to buttons, select menus and modals as well as to commands, and [`meocord/testing`](guide:testing) runs a
handler through the same pipeline the bot uses. Scheduled work is a service that starts in `onReady` and stops in
`onShutdown`, as [Scheduled tasks](guide:recipes/scheduled) shows. MeoCord is built for TypeScript, so a JavaScript bot
moves to it as it moves over, and its decorators and typed params become what the compiler checks.

## Moving over

Move a piece at a time. A command's `chatInputRun` body usually moves as it is into a controller method, and what it
read from the container becomes a constructor parameter. A precondition becomes a guard, and a `messageRun` becomes
a pattern whose params replace the `args.pick` calls.

## Next steps

- [Getting started](guide:getting-started): create a bot and start it.
- [Services](guide:services): what replaces the container, and how a test swaps one.
- [Message commands](guide:message-commands): prefixes, patterns and what a user sees on a misuse.
