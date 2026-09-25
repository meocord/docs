---
id: coming-from-discordx
title: Coming from discordx
section: Coming from
order: 82
since: 4.1.0
---

discordx and MeoCord both describe a bot with decorators on classes. They differ in what they take off your
hands. With discordx, the bot imports its files, passes each interaction to `executeInteraction`, and calls
`initApplicationCommands` itself. MeoCord does all three from one app class. This page shows one small bot
both ways. The discordx side is typechecked against `discordx` 11.13.3.

## What maps to what

| In discordx                                      | In MeoCord                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------- |
| A `@Discord()` class                             | A `@Controller()` class, listed in the app class                        |
| `@Slash` and a `@SlashOption` per parameter      | `@Command` with a `@CommandBuilder` class                               |
| `@ButtonComponent({ id })`, a string or a RegExp | `@Command('card/{ownerId}/refresh', CommandType.BUTTON)`, with captures |
| A guard function with `next()`                   | A [guard](/docs/4.1/guards) class, which can inject services            |
| `RateLimit` from `@discordx/utilities`           | [`@Cooldown`](/docs/4.1/cooldowns)                                      |
| `@On({ event })` with `ArgsOf`                   | `@On('guildMemberAdd')`, with the event's own arguments                 |
| `DIService.engine` set to tsyringe or TypeDI     | Built in: [services](/docs/4.1/services) are injected by constructor    |
| `importx` over your files                        | The app class's `controllers` list                                      |

## A slash command

discordx describes the command in its decorators, one per option, and uses tsyringe here for injection:

::example{from="compare" file="discordx/greet.ts" region="command"}

::example{from="compare" file="discordx/greeting.service.ts" region="service"}

In MeoCord the builder is a discord.js `SlashCommandBuilder`, the options arrive together as one argument,
and injection needs no container of your choosing:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

## A button with an owner

discordx's docs show a button `id` as an exact string; its types also accept a regular expression, which a
button that carries data in its `customId` needs. The guard then reads the owner from the `customId`
itself:

::example{from="compare" file="discordx/card.ts" region="button"}

MeoCord's pattern names its parts, and the guard receives them already captured:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

## Events and startup

::example{from="compare" file="discordx/welcome.ts" region="listener"}

The client is created, wired and started by hand:

::example{from="compare" file="discordx/main.ts" region="client"}

In MeoCord, an event handler receives the event's arguments as discord.js emits them, and the app class does
the wiring:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app.ts" region="app"}

## Testing

MeoCord's testing module runs a handler through the pipeline the bot uses, with its guards, cooldowns and
filters, on mocks of the discord.js objects:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## Moving over

Class by class: a `@Discord()` class becomes a `@Controller()`, each `@Slash` a `@Command` with a builder, and
the `@SlashOption` parameters become that builder's options, read from the handler's second argument. See
[Command types](/docs/4.1/command-types) and the [tutorial](/docs/4.1/tutorial).
