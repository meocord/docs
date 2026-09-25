---
id: coming-from-necord
title: Coming from Necord
section: Coming from
order: 83
since: 4.1.0
---

Necord brings discord.js into NestJS: handlers are Nest providers, guards are Nest guards, and the bot runs
inside a Nest application. MeoCord borrows the same ideas, controllers, services, guards, interceptors and
filters, without Nest. It builds them for Discord alone. This page shows one small bot both ways. The Necord
side is typechecked against `necord` 7.0.0 with `@nestjs/core` 12.1.0.

## What maps to what

| In Necord                                             | In MeoCord                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------- |
| A Nest module listing every provider                  | The app class, listing controllers                                      |
| `@SlashCommand` on a provider method                  | `@Command` on a controller method, with a `@CommandBuilder` class       |
| An options class with `@StringOption`, `@Options()`   | The builder's options, arriving as the handler's second argument        |
| `@Context() [interaction]`                            | The interaction as the handler's first argument                         |
| `@Button('card/:ownerId/refresh')`, `@ComponentParam` | `@Command('card/{ownerId}/refresh', CommandType.BUTTON)`, with captures |
| A Nest `CanActivate` and `NecordExecutionContext`     | A [guard](/docs/4.1/guards), given the interaction directly             |
| `@On('guildMemberAdd')` with `ContextOf`              | `@On('guildMemberAdd')`, with the event's own arguments                 |
| Nest providers and `@Injectable()`                    | [Services](/docs/4.1/services) with `@Service()`                        |

## A slash command

Necord reads the options from a class of its own, and the interaction from the context tuple:

::example{from="compare" file="necord/greet.command.ts" region="command"}

::example{from="compare" file="necord/greeting.service.ts" region="service"}

In MeoCord the builder is a discord.js `SlashCommandBuilder`, and the handler receives the interaction and
the options directly:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

::example{file="services/greeting.service.ts" region="service"}

## A button with an owner

Necord's guard is a Nest guard, so it reaches the interaction through Nest's execution context:

::example{from="compare" file="necord/card.component.ts" region="button"}

A MeoCord guard receives the interaction, and the pattern's captures, as arguments. Throwing
`GuardDeniedError` answers the member privately:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

## Events and startup

::example{from="compare" file="necord/welcome.listener.ts" region="listener"}

::example{from="compare" file="necord/app.module.ts" region="module"}

MeoCord needs no Nest application around the bot. The app class holds the client options and the
controllers, and `meocord start` runs it:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app.ts" region="app"}

## Testing

Where a Necord bot is tested through Nest's testing tools, MeoCord has a testing module made for handlers.
It runs one through the pipeline the bot uses, on mocks of the discord.js objects:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## Moving over

Necord providers become controllers and services almost line for line: `@Injectable()` becomes
`@Service()`, a handler's `@Context()` tuple becomes its first argument, and Nest guards become MeoCord
guards. A bot that uses Nest for more than Discord, an HTTP API for instance, may be better off staying on
Nest. See [Services](/docs/4.1/services) and the [tutorial](/docs/4.1/tutorial).
