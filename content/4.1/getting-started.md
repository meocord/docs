---
id: getting-started
title: Getting started
section: Start
order: 1
---

## What you need

- **A runtime:** Node.js 22.13 or newer, or Bun 1.x.
- **TypeScript:** 5.0 or newer with `skipLibCheck` on, as generated projects have it; 5.8 or newer with it
  off.
- **A package manager:** npm, yarn, pnpm or bun.
- **A Discord application** with a bot, from the
  [Discord Developer Portal](https://discord.com/developers/applications), and its token.

`discord.js` 14 and `dotenv` 18 are peer dependencies; `meocord create` installs both. MeoCord ships ESM and
CommonJS builds, and new projects are set up for ESM.

## Create a project

```bash
npx meocord create my-bot
```

The CLI asks which package manager to use, or takes it as a flag: `--use-npm`, `--use-yarn`, `--use-pnpm` or
`--use-bun`. The project is named after the argument and pins the MeoCord version that created it.

It starts with a working example of each kind of controller: a slash command, a button, a select menu, a
modal, a context menu, a message handler and a reaction handler, plus a guard, a presenter, a service and
a spec for each. The samples answer through `respond()`, acknowledge slow work with `@Defer`, and limit
how often they run with `@Cooldown`.

## Add your token and start

```bash
cd my-bot
cp .env.example .env              # then put your token in DISCORD_TOKEN
npx meocord start --dev           # development, rebuilding and restarting on every change
npx meocord start --build --prod  # a production build, then start it
```

The token is read from the environment, not written into `meocord.config.ts`, which is committed; `.env`
is ignored by git, so a token cannot be pushed by accident. Building needs no token, only starting does.

Next, [write a first command](/docs/4.1/quick-start).
