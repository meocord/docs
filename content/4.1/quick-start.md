---
id: quick-start
title: A first command
section: Start
order: 2
---

A slash command in MeoCord has three parts: a builder that describes it to Discord, a controller method
that handles it, and the app class that registers the controller. This page builds `/greet`, which answers
"Hello, Ada!" to `/greet name:Ada`.

## Describe the command

A command Discord knows about needs a builder, which is what gets registered. The builder receives the
command's name from `@Command`, so the two cannot drift apart:

::example{file="controllers/slash/builders/greeting.builder.ts" region="builder"}

## Handle it

The controller binds a method to the command with `@Command`. The method receives the interaction, and
the options the user filled in as its second argument. It answers through
[`respond()`](/docs/4.1/api/common/respond), and `@Cooldown` allows three calls per user every ten
seconds:

::example{file="controllers/slash/greeting.slash.controller.ts" region="controller"}

The greeting itself comes from a service, a plain class marked with `@Service()`. The controller asks for
it in its constructor, and MeoCord creates one instance and passes it in:

::example{file="services/greeting.service.ts" region="service"}

## Register the controller

The app class lists the controllers, and the discord.js client options:

::example{file="app.ts" region="app"}

`GreetingService` needs no listing: a controller that injects it is enough. See
[Services and injection](/docs/4.1/services) for the services you do list.

## Test it

`MeoCordTestingModule` runs the handler through the same pipeline the bot does, with no Discord
connection, and `getResponse` reports what `respond()` sent:

::example{file="controllers/slash/greeting.slash.controller.spec.ts"}

Run `npx meocord start --dev`, and `/greet` appears in Discord. Where it is registered, and how fast it
shows up, is covered in [Registering commands](/docs/4.1/command-registration).
