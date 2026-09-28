---
id: necord
title: Coming from Necord
chapter: appendix
group: coming-from
order: 4
summary: One small bot written with Necord and with MeoCord, side by side, and what each Nest provider becomes.
requires: [first-command]
api:
  [
    decorators/Service,
    decorators/Command,
    decorators/CommandBuilder,
    decorators/MessageHandler,
    decorators/On,
    decorators/UseGuard,
    decorators/Catch,
  ]
formerly: [coming-from-necord]
---

Necord brings discord.js into NestJS: handlers are Nest providers, guards are Nest guards, and the bot runs inside a
Nest application. MeoCord borrows the same ideas, controllers, services, guards, interceptors and filters, without
Nest. It builds them for Discord alone. This page shows one small bot both ways. The Necord side is typechecked
against `necord` 7.0.0 with `@nestjs/core` 12.1.0.

## What maps to what

| In Necord                                             | In MeoCord                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| A Nest module listing every provider                  | The app class, listing controllers                                      |
| `@SlashCommand` on a provider method                  | `@Command` on a controller method, with a `@CommandBuilder` class       |
| An options class with `@StringOption`, `@Options()`   | The builder's options, arriving as the handler's second argument        |
| `@Context() [interaction]`                            | The interaction as the handler's first argument                         |
| `@Button('card/:ownerId/refresh')`, `@ComponentParam` | `@Command('card/{ownerId}/refresh', CommandType.BUTTON)`, with captures |
| `@TextCommand` and `@Arguments()`                     | A [message command](guide:message-commands) pattern, with typed params  |
| A Nest `CanActivate` and `NecordExecutionContext`     | A [guard](guide:guards), given the interaction directly                 |
| A Nest exception filter and `NecordArgumentsHost`     | An [exception filter](guide:exception-filters), given the call          |
| `@On('guildMemberAdd')` with `ContextOf`              | [`@On('guildMemberAdd')`](guide:gateway-events), with its own arguments |
| Nest providers and `@Injectable()`                    | [Services](guide:services) with `@Service()`                            |

## A slash command

Necord reads the options from a class of its own, and the interaction from the context tuple:

::example{from="compare" file="necord/greet.command.ts" region="command"}

::example{from="compare" file="necord/greeting.service.ts" region="service"}

In MeoCord the builder is a discord.js `SlashCommandBuilder`, and the handler receives the interaction and the
options directly:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

::example{file="services/greeting.service.ts" region="service"}

## A button with an owner

A Necord button is a route with `:` params, and its guard is a Nest guard that reads the interaction out of Nest's
execution context:

::example{from="compare" file="necord/card.component.ts" region="button"}

In MeoCord the guard receives the interaction itself, and any button can reuse it:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

## Message commands

A Necord text command receives its words as strings, and `NecordModule`'s `prefix` option sets the prefix:

::example{from="compare" file="necord/roll.command.ts" region="command"}

In MeoCord a message command is a pattern. Each param's type is written in the pattern and checked before the handler
runs, and a message that names the command but doesn't fit it gets the command's usage in reply:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

## Errors

Necord uses Nest's exception filters, which read the interaction from Necord's arguments host:

::example{from="compare" file="necord/error.filter.ts" region="filter"}

A MeoCord filter works the same way: `@UseFilter` applies it to a handler or a controller, and
`@MeoCord({ filters })` to the whole bot, and it is given the call's context. An error no filter handles reaches the
built-in fallback, which logs it and answers an interaction privately:

::example{file="filters/unknown-account.filter.ts" region="filter"}

## Events and startup

A Necord listener takes the event's arguments through `@Context()`, and the Nest module lists it with every other
provider:

::example{from="compare" file="necord/welcome.listener.ts" region="listener"}

::example{from="compare" file="necord/app.module.ts" region="module"}

In MeoCord the listener receives the event's arguments as they are, and the app class lists the controllers:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app.ts" region="app"}

## Testing

Necord bots test with Nest's testing module. MeoCord's runs a handler through the same pipeline the bot uses, with
mocks of the discord.js objects:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## When Necord is the better pick

If you already run NestJS, Necord puts the bot in the same application, sharing its modules, configuration and HTTP
API. That is often worth keeping; see [other ways to build a bot](guide:overview#other-ways-to-build-a-bot). MeoCord
suits a bot that is only a bot, with no Nest application around it.

## Moving over

Necord providers become controllers and services almost line for line: `@Injectable()` becomes `@Service()`, a
handler's `@Context()` tuple becomes its first argument, and Nest guards and filters become MeoCord's. A bot that uses
Nest for more than Discord, an HTTP API for instance, may be better off staying on Nest.

## Next steps

- [Getting started](guide:getting-started): create a bot and start it.
- [Services](guide:services): providers without a Nest module.
- [Exception filters](guide:exception-filters): what the member is told when a handler throws.
