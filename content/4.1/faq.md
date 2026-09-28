---
id: faq
title: FAQ
chapter: appendix
group: help
order: 3
summary: Short answers to what people ask first, about runtimes, JavaScript, discord.js, state, databases and tests.
requires: []
api: [decorators/MeoCord, testing/MeoCordTestingModule]
since: 4.1.0
formerly: []
---

Short answers, each with the chapter that explains it.

## Does MeoCord run on Bun, or only Node.js?

Both. The bot runs on Node.js 22.13 or later, or on Bun, and `meocord start` runs it on the runtime that started the
CLI: `bun run start:prod` under Bun, `npm run start:prod` under Node. See
[Which runtime the bot runs on](guide:deployment#which-runtime-the-bot-runs-on).

## Can I write a bot in plain JavaScript?

No. Controllers, commands and guards are declared with TypeScript's decorators, and injection reads the constructor
types TypeScript emits for them. A new project is set up for TypeScript, and `meocord build` compiles it.

## Can I use discord.js directly?

Yes. Handlers receive discord.js's own interactions, messages and reactions, and a service can inject the `Client`.
MeoCord makes the client from `@MeoCord({ clientOptions })`, and anything discord.js can do is still there. See
[Where discord.js begins](guide:overview#where-discordjs-begins).

## Where does state live?

In services. A controller or service is made once and shared by every call, so a `Map` on a service holds across
calls, and so do interceptors, exception filters, pipes and observers. A guard is made for each call and keeps
nothing between them, unless it's bound: supplied by a provider, listed in `services` or injected by another class,
in which case every call shares one instance. State that must survive a restart, or be shared between shard
processes, belongs in a database that a service wraps. See [What lives how long](guide:overview#what-lives-how-long).

## Does MeoCord include a database?

No. Use any client library. Provide the connection from an async factory in `@MeoCord({ providers })`: MeoCord awaits
it before the bot logs in, and injects it into the classes that ask for it. Close it in its `onShutdown`. The
[database recipe](guide:recipes/database) shows it with PostgreSQL. A native driver works with
[self-contained builds](guide:self-contained-builds), which pack it into `dist`.

## Does the bot reload while I edit it?

Yes. `meocord start --dev` rebuilds on every change and restarts the bot, one bot at a time. It watches
`meocord.config.ts` and `tsconfig.json` too. Commands go to `commands.developmentGuild`, if set, where they update at
once, and they're registered only when they changed. See
[Development and production](guide:cli#development-and-production).

## When do I need sharding?

When Discord asks for it: past about 2,500 servers, a bot that doesn't shard can't log in. Before that, one connection
is simpler. `sharding: { shards: 'auto' }` runs every shard in one process, and `mode: 'process'` gives each shard a
process of its own, spreading the work over CPU cores. See [Sharding](guide:sharding).

## How do I test a handler without Discord?

Build a testing module with the controller, and run the handler with `invoke`, through the same guards, cooldowns and
filters the bot uses, with mocks in place of discord.js's objects. See [Testing](guide:testing).

## Why decorators?

A handler's routing, guards, cooldowns and validation are declared where the handler is, and MeoCord reads them at
startup: nothing is wired to discord.js by hand, and a test can inspect what a handler is set up with. It's the model
NestJS uses on the server, applied to a bot.

## Where do I report a bug or ask a question?

In the [issue tracker](https://github.com/meocord/meocord/issues). The
[contributing guide](https://github.com/meocord/meocord/blob/main/CONTRIBUTING.md) covers working on MeoCord itself.
