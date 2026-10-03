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

| In Necord                                             | In MeoCord                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| A Nest module listing every provider                  | The app class, listing controllers                                                                        |
| `@SlashCommand` on a provider method                  | `@Command` on a controller method, with a `@CommandBuilder` class                                         |
| An options class with `@StringOption`, `@Options()`   | The builder's options, arriving as the handler's second argument                                          |
| `@Context() [interaction]`                            | The interaction as the handler's first argument                                                           |
| `@Button('card/:ownerId/refresh')`, `@ComponentParam` | `@Command('card/{ownerId}/refresh', CommandType.BUTTON)`, with captures                                   |
| `@TextCommand` and `@Arguments()`                     | A [message command](guide:message-commands) pattern, with typed params                                    |
| A Nest `CanActivate` and `NecordExecutionContext`     | A [guard](guide:guards), given the interaction directly                                                   |
| A Nest exception filter and `NecordArgumentsHost`     | An [exception filter](guide:exception-filters), given the call                                            |
| A Nest exception filter on a `@TextCommand`           | [`dmOnError` and `dmOnCooldown`](guide:message-commands#telling-the-author-privately), a DM to the author |
| `@On('guildMemberAdd')` with `ContextOf`              | [`@On('guildMemberAdd')`](guide:gateway-events), with its own arguments                                   |
| Nest providers and `@Injectable()`                    | [Services](guide:services) with `@Service()`                                                              |

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

In MeoCord a message command is a pattern. Each param is checked before the handler runs, here by a schema, and a
message that leaves out a required param gets the command's usage in reply, and one the schema refuses gets the reason:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

## Errors

Necord uses Nest's exception filters, which read the interaction from Necord's arguments host:

::example{from="compare" file="necord/error.filter.ts" region="filter"}

A MeoCord filter works the same way: `@UseFilter` applies it to a handler or a controller, and `@MeoCord({ filters })`
to the whole bot, and it is given the call's context. An error no filter handles reaches the
[built-in fallback](guide:exception-filters#the-built-in-fallback), which logs it and tells the member something went
wrong: privately, or in the reply a public `@Defer` started. A message command's error is logged only, apart from a
`UserError`, whose message is the reply, unless the app turns on
[`dmOnError`](guide:message-commands#telling-the-author-privately):

::example{file="filters/unknown-account.filter.ts" region="filter"}

## Events and startup

A Necord listener takes the event's arguments through `@Context()`, and the Nest module lists it with every other
provider:

::example{from="compare" file="necord/welcome.listener.ts" region="listener"}

::example{from="compare" file="necord/app.module.ts" region="module"}

In MeoCord the listener receives the event's arguments as they are, and the app class lists the controllers:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app-beyond-commands.ts" region="app"}

## Testing

Necord's package ships no testing helpers of its own. MeoCord's testing module runs a handler through the same
pipeline the bot uses, with mocks of the discord.js objects:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## What you gain

The ideas Necord borrows from Nest, controllers, services, guards, interceptors, pipes and exception filters, built
for Discord alone: the bot needs no Nest application, module or `@Injectable()` around it, and a guard receives the
interaction itself rather than an execution context to unwrap. Message commands get
[typed patterns](guide:message-params) with flags, and [`meocord/testing`](guide:testing) runs a handler through the
same pipeline the bot uses, with mocks of discord.js's own classes.

## Moving over

Necord providers become controllers and services almost line for line: `@Injectable()` becomes `@Service()`, a
handler's `@Context()` tuple becomes its first argument, and Nest guards and filters become MeoCord's.

## Next steps

- [Getting started](guide:getting-started): create a bot and start it.
- [Services](guide:services): providers without a Nest module.
- [Exception filters](guide:exception-filters): what the member is told when a handler throws.
