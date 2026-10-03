---
id: discordx
title: Coming from discordx
chapter: appendix
group: coming-from
order: 3
summary: One small bot written with discordx and with MeoCord, side by side, and what each decorator becomes.
requires: [first-command]
api:
  [
    decorators/Controller,
    decorators/Command,
    decorators/CommandBuilder,
    decorators/MessageHandler,
    decorators/On,
    decorators/UseGuard,
    decorators/Cooldown,
  ]
formerly: [coming-from-discordx]
---

discordx and MeoCord both describe a bot with decorators on classes. They differ in what they take off your hands.
With discordx, the bot imports its files, passes each interaction to `executeInteraction` and each message to
`executeCommand`, and calls `initApplicationCommands` itself. MeoCord does all of that from one app class. This page
shows one small bot both ways. The discordx side is typechecked against `discordx` 11.13.3.

## What maps to what

| In discordx                                      | In MeoCord                                                                                                |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| A `@Discord()` class                             | A `@Controller()` class, listed in the app class                                                          |
| `@Slash` and a `@SlashOption` per parameter      | `@Command` with a `@CommandBuilder` class                                                                 |
| `@ButtonComponent({ id })`, a string or a RegExp | `@Command('card/{ownerId}/refresh', CommandType.BUTTON)`, with captures                                   |
| `@SimpleCommand` and a `@SimpleCommandOption`    | A [message command](guide:message-commands) pattern, with typed params                                    |
| A guard function with `next()`                   | A [guard](guide:guards) class, which can inject services                                                  |
| A `catch` around `executeCommand`                | [`dmOnError` and `dmOnCooldown`](guide:message-commands#telling-the-author-privately), a DM to the author |
| `RateLimit` from `@discordx/utilities`           | [`@Cooldown`](guide:cooldowns)                                                                            |
| `@On({ event })` with `ArgsOf`                   | [`@On('guildMemberAdd')`](guide:gateway-events), with its own arguments                                   |
| `DIService.engine` set to tsyringe or TypeDI     | Built in: [services](guide:services) are injected by constructor                                          |
| `importx` over your files                        | The app class's `controllers` list                                                                        |

## A slash command

discordx describes the command in its decorators, one per option, and uses tsyringe here for injection:

::example{from="compare" file="discordx/greet.ts" region="command"}

::example{from="compare" file="discordx/greeting.service.ts" region="service"}

In MeoCord the builder is a discord.js `SlashCommandBuilder`, the options arrive together as one argument, and
injection needs no container of your choosing:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

## A button with an owner

discordx matches a button's `customId` against a string or a regular expression, and the handler reads its parts
itself. A guard is a function that calls `next()` to let the call through:

::example{from="compare" file="discordx/card.ts" region="button"}

In MeoCord the pattern captures `ownerId`, and the guard is a class, so it can inject services:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

## Message commands

A discordx simple command declares each word as a `@SimpleCommandOption`, and runs only when the bot hands each
message to `executeCommand`:

::example{from="compare" file="discordx/messages.ts" region="client"}

::example{from="compare" file="discordx/roll.ts" region="command"}

In MeoCord a message command is a pattern, and MeoCord reads every message itself. A message that leaves out a required
param gets the command's usage in reply, and one the schema refuses gets the reason:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

## Errors

discordx's documentation names no hook for an error a handler throws, so the bot catches it where it calls
`executeInteraction`, or in the handler. In MeoCord, the error reaches the handler's
[exception filters](guide:exception-filters) first, then the
[built-in fallback](guide:exception-filters#the-built-in-fallback), which logs it and tells the member something went
wrong: privately, or in the reply a public `@Defer` started. A message command's error is logged only, apart from a
`UserError`, whose message is the reply, unless the app turns on
[`dmOnError`](guide:message-commands#telling-the-author-privately).

## Events and startup

A discordx listener takes the event's arguments as one tuple, typed with `ArgsOf`, and the bot finds the class by
importing its file:

::example{from="compare" file="discordx/welcome.ts" region="listener"}

::example{from="compare" file="discordx/main.ts" region="client"}

In MeoCord the listener receives the event's arguments as they are, and the app class lists the controllers:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app-beyond-commands.ts" region="app"}

## Testing

MeoCord runs a handler through the same pipeline the bot uses, with mocks of the discord.js objects:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## What you gain

Guards are classes that inject services, [exception filters](guide:exception-filters) decide what a member is told
when a handler throws, [typed catalogs](guide:localisation) translate the bot, and
[`meocord/testing`](guide:testing) runs a handler through the same pipeline the bot uses. Pagination is a component
with a typed route, as [Paginated lists](guide:recipes/pagination) shows. Each bot is its own process, with its own
config, token and logs, so it restarts and deploys on its own, and one bot spreads across processes with
[sharding](guide:sharding).

## Moving over

Class by class: a `@Discord()` class becomes a `@Controller()`, each `@Slash` a `@Command` with a builder, and the
`@SlashOption` parameters become that builder's options, read from the handler's second argument. A guard function
becomes a guard class, and a `@SimpleCommand` a pattern.

## Next steps

- [Getting started](guide:getting-started): create a bot and start it.
- [Slash commands](guide:slash-commands): builders, options and registration.
- [Guards](guide:guards): checks that run before a handler, and tell the caller why not.
