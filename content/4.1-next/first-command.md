---
id: first-command
title: Your first command
chapter: start
order: 3
summary: Write a slash command with a builder, a controller and a service, register it in the app, and test it.
learn:
  - Describe a slash command to Discord with a builder
  - Handle it in a controller method that uses a service
  - List the controller in the app, and test the handler
requires: [getting-started]
api: [decorators/Command, decorators/CommandBuilder, decorators/Controller, decorators/Service, responses/respond]
formerly: [quick-start]
---

A slash command in MeoCord has three parts: a builder that describes it to Discord, a controller method that handles
it, and the app class that lists the controller. This page builds `/greet`, which answers "Hello, Ada!" to
`/greet name:Ada`.

## When to use it

Every command, button and form in a MeoCord bot follows this shape, so write this one first: the chapters after it add
options, components and stages to the same three parts. To scaffold them instead, run
`npx meocord generate controller slash greeting`: it writes a controller, its builder and its spec, and
[the CLI](guide:cli) lists every generator.

## Example

The builder describes the command. It receives the command's name from `@Command`, so the two can't drift apart:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

The controller binds a method to the command with `@Command`. The method receives the interaction, and the options the
user filled in as its second argument. It answers through [`respond()`](guide:responses), and `@Cooldown` allows three
calls per user every ten seconds:

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

The greeting comes from a service, a plain class marked with `@Service()`:

::example{file="services/greeting.service.ts" region="service"}

The app class lists the controller, and the discord.js client options:

::example{file="app.ts" region="app"}

Run `npx meocord start --dev`, and `/greet` appears in your test server.

## How it works

### The builder

A command Discord knows about needs a builder, which is what gets registered: `@CommandBuilder(CommandType.SLASH)`
marks the class, and its `build()` returns a discord.js `SlashCommandBuilder`. MeoCord calls it once, as the class
loads, with the name `@Command` gives, and registers what it returns when the bot is ready.
[Slash commands](guide:slash-commands) covers options, subcommands, and where commands are registered.

### The controller

`@Controller()` marks a class whose methods handle calls, and `@Command('greet', GreetingCommandBuilder)` binds one of
them to `/greet`. The options arrive as a plain object, named as the builder names them, so the handler reads `name`
without going through `interaction.options`.

### The service

The controller asks for `GreetingService` in its constructor, and MeoCord creates one instance and passes it in. The
same instance serves every call, and any other class that asks for it. The service needs no listing in the app: a
controller that injects it is enough. [Services](guide:services) covers the services you do list, and values that
aren't classes.

### The app

`@MeoCord` marks the class `src/main.ts` starts, and lists its controllers. A controller missing from `controllers` is
never bound, and its commands are never registered. `clientOptions` are discord.js's own: `GatewayIntentBits.Guilds` is
enough for slash commands, which arrive without further intents.

## Testing

`MeoCordTestingModule` runs the handler through the same pipeline the bot does, with no Discord connection, and
`getResponse` reports what `respond()` sent:

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

Run the specs with `npm test`, or your package manager's equivalent. [Testing](guide:testing) covers the module, and the
mocks for every interaction type.

## Gotchas

- **A new controller does nothing until it's in `controllers`.** `meocord generate` doesn't edit `src/app.ts`, so add
  each class it writes there yourself.
- **A command's name is lowercase,** at most 32 characters, with no spaces: Discord refuses others, and the builder
  throws as the bot starts, naming the builder and the command.
- **A method called directly skips the pipeline.** In a test, go through `invoke`, so guards, cooldowns and filters run
  as they do in the bot.

## Next steps

- [Project structure](guide:project-structure): where the files go as the bot grows.
- [Slash commands](guide:slash-commands): options, subcommands and registration.
- [Services](guide:services): what a controller can ask for, and how long each instance lives.
