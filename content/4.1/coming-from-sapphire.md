---
id: coming-from-sapphire
title: Coming from Sapphire
section: Coming from
order: 81
since: 4.1.0
---

Sapphire and MeoCord both sit on discord.js and both take the plumbing off your hands. They differ in shape.
Sapphire builds a bot from pieces, classes it loads from folders by convention. MeoCord builds it from
decorated controllers that an app class lists, with dependencies injected by constructor. This page shows one
small bot both ways. The Sapphire side is typechecked against `@sapphire/framework` 5.5.1.

## What maps to what

| In Sapphire                                        | In MeoCord                                                          |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| A `Command` piece in `commands/`                   | A controller method with `@Command`, listed in the app class        |
| `registerApplicationCommands` and its registry     | A `@CommandBuilder` class                                           |
| An `InteractionHandler` with `parse()` and `run()` | A method with a `customId` pattern such as `card/{ownerId}/refresh` |
| A precondition                                     | A [guard](/docs/4.1/guards), for commands and components alike      |
| `cooldownLimit` and `cooldownDelay`                | [`@Cooldown`](/docs/4.1/cooldowns)                                  |
| A `Listener` piece in `listeners/`                 | `@On` on a controller method                                        |
| `container`, augmented with your own properties    | [Services](/docs/4.1/services), injected by constructor             |

## A slash command

A Sapphire command is a class that registers itself, reads its options from the interaction, and reaches
shared objects through the container:

::example{from="compare" file="sapphire/commands/greet.ts" region="command"}

::example{from="compare" file="sapphire/greeting.service.ts" region="service"}

In MeoCord, the builder is its own class, the options arrive as an argument, and the service is a
constructor parameter, typed by its class with no augmentation:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

::example{file="services/greeting.service.ts" region="service"}

## A button with an owner

An interaction handler claims a button in `parse()`, and checks its owner itself:

::example{from="compare" file="sapphire/interaction-handlers/refresh.ts" region="button"}

MeoCord matches the `customId` against a pattern and captures its parts. The owner check is a guard, the same
kind of guard a command uses:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

## Events and startup

A listener is a piece, and the client loads every piece from the folders beside its entry point:

::example{from="compare" file="sapphire/listeners/welcome.ts" region="listener"}

::example{from="compare" file="sapphire/main.ts" region="client"}

MeoCord loads nothing by folder. Events are methods on controllers, and the app class names every controller
the bot runs:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app.ts" region="app"}

## Testing

MeoCord runs a handler through the pipeline the bot uses, with its guards, cooldowns and filters, on mocks of
the discord.js objects, and records what it sent:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## Moving over

Move a piece at a time. A command's `chatInputRun` body usually moves as is into a controller method; what
it read from the container becomes a constructor parameter. See [Services](/docs/4.1/services) for
injection, and the [tutorial](/docs/4.1/tutorial) for a whole bot.
