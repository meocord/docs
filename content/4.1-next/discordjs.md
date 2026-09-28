---
id: discordjs
title: Coming from discord.js
chapter: appendix
group: coming-from
order: 1
summary: One small bot written with discord.js alone and with MeoCord, side by side, and what each part becomes.
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
formerly: [coming-from-discordjs]
---

MeoCord runs on discord.js 14. Every interaction, message and client you handle is the discord.js object you know,
so what changes is the code around your handlers: routing, registration, error answers, cooldowns and tests. This
page shows one small bot both ways. The discord.js side is typechecked against discord.js 14.27.0.

## What maps to what

| In a discord.js bot                                     | In MeoCord                                                                  |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| A `SlashCommandBuilder`, sent with `REST` from a script | A `@CommandBuilder` class, registered when the bot starts                   |
| The `interactionCreate` listener and its `if` chain     | `@Command` on a controller method; MeoCord routes to it                     |
| Splitting `customId` by hand                            | A pattern such as `card/{ownerId}/refresh`, captured into an argument       |
| A `messageCreate` listener that splits the content      | A [message command](guide:message-commands) pattern, such as `roll {sides}` |
| Checks at the top of a handler                          | A [guard](guide:guards)                                                     |
| A `Map` of timestamps                                   | [`@Cooldown`](guide:cooldowns)                                              |
| `try`/`catch` around every handler                      | The built-in fallback, or an [exception filter](guide:exception-filters)    |
| `client.on(Events.GuildMemberAdd, ...)`                 | [`@On('guildMemberAdd')`](guide:gateway-events) on a controller method      |
| Modules you import and pass around                      | [Services](guide:services), injected by constructor                         |

## A slash command

In discord.js, the command is a builder you send to Discord yourself, and its handler is a branch of the interaction
listener. The cooldown is yours to keep:

::example{from="compare" file="discordjs/bot.ts" region="register"}

::example{from="compare" file="discordjs/bot.ts" region="command"}

In MeoCord, the builder receives its name from `@Command`, registration happens at startup, and the cooldown is a
decorator. The member's `name` arrives as an argument:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

## A button with an owner

discord.js hands every button to the same listener, so the `customId` is split and checked by hand:

::example{from="compare" file="discordjs/bot.ts" region="button"}

MeoCord routes by pattern, and the owner check becomes a guard that any button can reuse:

::example{file="controllers/button/card.button.controller.ts" region="defer"}

::example{file="guards/owner.guard.ts" region="guard"}

`@Defer()` acknowledges the click at once, so a slow handler never hits Discord's three-second limit.

## Message commands

A prefix command in discord.js is a `messageCreate` listener: the prefix, the split into words and the check of each
word are the bot's own:

::example{from="compare" file="discordjs/prefix.ts" region="prefix"}

In MeoCord it is a pattern. The app sets the prefix once, each param is typed and checked before the handler runs,
and a message that names the command but doesn't fit it gets the command's usage in reply:

::example{file="controllers/message/dice.message.controller.ts" region="pattern"}

## Errors

The discord.js bot wraps its listener in `try`/`catch`, and decides there what the member sees. In MeoCord, an error
a handler throws reaches its [exception filters](guide:exception-filters) first, then the built-in fallback, which
logs it and answers an interaction privately. A filter answers an error of its own type in its own words:

::example{file="filters/unknown-account.filter.ts" region="filter"}

## Events and the client

In discord.js, the client, its listeners and the error handling are wired up together:

::example{from="compare" file="discordjs/bot.ts" region="client"}

In MeoCord, an event is a decorated method, and the app class lists the controllers and client options:

::example{file="controllers/event/welcome.controller.ts" region="controller"}

::example{file="app.ts" region="app"}

## Shared logic

The discord.js bot keeps its shared logic in a plain module. In MeoCord it is a service, created once and injected
where it is needed, which a test can replace:

::example{file="services/greeting.service.ts" region="service"}

## Testing

MeoCord runs a handler through the same pipeline the bot uses, with mocks of the discord.js objects, and records what
it sent:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

## When discord.js alone is the better pick

discord.js alone has no framework to learn and nothing between you and the API. For a small bot, or to learn how
Discord works, that is often the right choice; see
[other ways to build a bot](guide:overview#other-ways-to-build-a-bot). MeoCord pays off once the routing,
registration, checks and error answers you would write by hand grow with the bot.

## Moving over

Nothing has to move at once. The `Client` is injectable, so code that works on the client directly can live in a
service while commands move to controllers one at a time.

## Next steps

- [Getting started](guide:getting-started): create a bot and start it.
- [Your first command](guide:first-command): a slash command, its service and its test.
- [Message commands](guide:message-commands): prefixes, patterns and what a user sees on a misuse.
