---
id: coming-from-discordjs
title: Coming from discord.js
section: Coming from
order: 80
since: 4.1.0
---

MeoCord runs on discord.js 14. Every interaction, message and client you handle is the discord.js object you
know, so what changes is the code around your handlers: routing, registration, error answers, cooldowns
and tests. This page shows one small bot both ways. The discord.js side is typechecked against discord.js
14.27.0.

## What maps to what

| In a discord.js bot                                     | In MeoCord                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| A `SlashCommandBuilder`, sent with `REST` from a script | A `@CommandBuilder` class, registered when the bot starts                    |
| The `interactionCreate` listener and its `if` chain     | `@Command` on a controller method; MeoCord routes to it                      |
| Splitting `customId` by hand                            | A pattern such as `card/{ownerId}/refresh`, captured into an argument        |
| Checks at the top of a handler                          | A [guard](/docs/4.1/guards)                                                  |
| A `Map` of timestamps                                   | [`@Cooldown`](/docs/4.1/cooldowns)                                           |
| `try`/`catch` around every handler                      | The built-in fallback, or an [exception filter](/docs/4.1/exception-filters) |
| `client.on(Events.GuildMemberAdd, ...)`                 | `@On('guildMemberAdd')` on a controller method                               |
| Modules you import and pass around                      | [Services](/docs/4.1/services), injected by constructor                      |

## A slash command

In discord.js, the command is a builder you send to Discord yourself, and its handler is a branch of the
interaction listener. The cooldown is yours to keep:

::example{from="compare" file="discordjs/bot.ts" region="register"}

::example{from="compare" file="discordjs/bot.ts" region="command"}

In MeoCord, the builder receives its name from `@Command`, registration happens at startup, and the cooldown
is a decorator. The member's `name` arrives as an argument:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

## A button with an owner

discord.js hands every button to the same listener, so the `customId` is split and checked by hand:

::example{from="compare" file="discordjs/bot.ts" region="button"}

MeoCord routes by pattern, and the owner check becomes a guard that any button can reuse:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

`@Defer()` acknowledges the click at once, so a slow handler never hits Discord's three-second limit.

## Events and the client

In discord.js, the client, its listeners and the error handling are wired up together:

::example{from="compare" file="discordjs/bot.ts" region="client"}

In MeoCord, an event is a decorated method, and the app class lists the controllers and client options.
Errors a handler throws reach the built-in fallback, which logs them and answers the member privately:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app.ts" region="app"}

## Shared logic

The discord.js bot keeps its shared logic in a plain module. In MeoCord it is a service, created once and
injected where it is needed, which a test can replace:

::example{file="services/greeting.service.ts" region="service"}

## Testing

MeoCord runs a handler through the same pipeline the bot uses, with mocks of the discord.js objects, and
records what it sent:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## Moving over

Nothing has to move at once. The `Client` is injectable, so code that works on the client directly can
live in a service while commands move to controllers one at a time. Start from
[Getting started](/docs/4.1/getting-started), or follow the [tutorial](/docs/4.1/tutorial) for a whole bot.
