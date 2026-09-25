---
id: faq
title: FAQ
section: Help
order: 101
since: 4.1.0
---

## Does MeoCord run on Bun, or only Node.js?

Both. The bot runs on Node.js 22.13 or later, or on Bun, and `meocord start` runs it on whichever runtime
started the CLI. See [Deployment](/docs/4.1/deployment#which-runtime-the-bot-runs-on).

## Can I write a bot in plain JavaScript?

No. Controllers, commands and guards are declared with TypeScript's decorators, and injection reads the
constructor types TypeScript emits for them. A generated app is set up for TypeScript, and `meocord build`
compiles it.

## Can I use discord.js directly?

Yes. Handlers receive discord.js's own interactions, messages and reactions, and a service can inject the
`Client`. MeoCord creates the client from `@MeoCord({ clientOptions })`; anything discord.js does is still
available. See [Services and injection](/docs/4.1/services#what-you-can-inject).

## Where does state live?

In services. A controller or service is created once and shared by every call, so a `Map` on a service holds
across calls. A guard, by contrast, is created for every call, so it keeps nothing between them. State that
must survive a restart, or be shared between shard processes, belongs in a database or a store a service
wraps. See [Services and injection](/docs/4.1/services).

## Does MeoCord include a database?

No. Use any client library in a service, connect in [`onReady`](/docs/4.1/lifecycle-hooks) and close in
`onShutdown`. A native driver works with [self-contained builds](/docs/4.1/self-contained-builds), which pack
it into `dist`.

## Does the bot reload while I edit it?

`meocord start --dev` rebuilds on every change and restarts the bot. Commands go to
`commands.developmentGuild`, if set, where they update at once. See [The CLI](/docs/4.1/cli).

## When do I need sharding?

When the bot is in about 2,500 servers, Discord requires it. Before that, one connection is simpler; with it,
`sharding: { shards: 'auto' }` runs every shard in one process, and `mode: 'process'` spreads them across CPU
cores. See [Sharding](/docs/4.1/sharding).

## How do I test a handler without Discord?

Build a testing module with the controller, and run the handler with `invoke`, as the bot would, with mocks
in place of discord.js objects. See [Testing](/docs/4.1/testing).

## Why decorators?

A handler's routing, guards, cooldowns and validation are declared where the handler is, and MeoCord reads
them at startup: nothing is registered by hand, and a test can inspect what a handler is set up with. It is
the model NestJS uses on the server, applied to a bot.

## Where do I report a bug or ask a question?

In the [issue tracker](https://github.com/meocord/meocord/issues). The
[contributing guide](https://github.com/meocord/meocord/blob/main/CONTRIBUTING.md) covers working on MeoCord
itself.
