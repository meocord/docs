---
id: overview
title: Overview
section: Start
order: 0
formerly: [features]
---

MeoCord is a framework for Discord bots built on [discord.js](https://discord.js.org). You write a bot as
controllers and services, and decorators connect them to Discord: `@Command` binds a method to a slash
command, a button or a modal, and the framework routes each interaction to it.

Every call a handler receives passes through the same pipeline. Guards decide whether it runs,
interceptors wrap it, validation and pipes check and shape its input, cooldowns limit how often it runs,
and exception filters decide what the user is told when it throws. Each of these applies to one method,
a whole controller, or the entire bot.

## What it covers

- **Every interaction Discord sends:** slash commands and their subcommands, autocomplete, buttons, all
  five select menus, modals, context menus and activity entry points, plus messages, reactions and any
  gateway event.
- **Dependency injection:** services are plain classes, and a controller receives them by declaring them
  in its constructor.
- **Answering Discord:** `respond(interaction)` picks the right Discord call from wherever the answer
  stands, deferred or replied, including in user-installed apps; `@Defer` acknowledges slow work for you.
- **Command registration:** globally, to a list of servers, or to a development server, at startup or from
  CI with `meocord register`.
- **Testing:** `MeoCordTestingModule` runs a handler through its whole pipeline with no Discord connection,
  and the mocks behave like the real discord.js classes.
- **A CLI:** `meocord create` starts a project, `meocord generate` scaffolds controllers, services and the
  rest, each with a spec, and `meocord build` and `meocord start` build with Rsbuild.

## Where to go next

- New to MeoCord: [Getting started](/docs/4.1/getting-started), then [a first command](/docs/4.1/quick-start).
- Upgrading from 4.0: the [migration guide](/docs/4.1/migrating) lists what to check.
- Looking for a class or a function: the [API reference](/docs/4.1/api/core/MeoCordFactory) is generated
  from the published package.
