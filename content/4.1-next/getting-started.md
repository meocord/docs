---
id: getting-started
title: Getting started
chapter: start
order: 2
summary: Create a MeoCord project with the CLI, give it a bot token, and start it in development with a test server.
learn:
  - Create a project with the create command
  - Give it a bot token without committing it
  - Start it in development and in production
requires: [overview]
api: [configuration/MeoCordConfig]
---

The `create` command writes a project that runs as it is: a sample of each kind of handler, a spec beside each, and the
scripts to build, test and lint it. You give it a bot token, and `meocord start --dev` puts it online, rebuilding and
restarting as you edit.

## When to use it

Start here for a new bot. To move a discord.js bot to MeoCord, create the project the same way and bring its commands
over one controller at a time; [Coming from discord.js](guide:coming-from/discordjs) shows how each part maps.

You need:

- **A runtime:** Node.js 22.13 or newer, or Bun 1.x.
- **A package manager:** npm, yarn, pnpm or bun.
- **A Discord application** with a bot, and its token, from the
  [Discord Developer Portal](https://discord.com/developers/applications).
- **A server to test in,** where you can add the bot.

`discord.js` 14 and `dotenv` 18 are peer dependencies, which the `create` command installs. TypeScript comes with the
project, and 5.0 or newer works. Keep `skipLibCheck` on, as generated projects have it: discord.js's own dependencies
don't typecheck without it.

## Example

```bash
npx {{meocord}} create my-bot
cd my-bot
cp .env.example .env         # then put your bot token in DISCORD_TOKEN
npx meocord start --dev      # development, rebuilding and restarting on every change
```

The CLI asks which package manager to use, or takes it as a flag: `--use-npm`, `--use-yarn`, `--use-pnpm` or
`--use-bun`. The project is named after the argument, and depends on the MeoCord version that created it, as a `^`
range. `create` runs before there is a project, so it names the package to install, `{{meocord}}`. Inside the project,
`npx meocord` runs the version the project installed.

## How it works

### What the project starts with

A working example of each kind of handler: a slash command, a button, a select menu, a modal, a context menu, a message
handler and a reaction handler, plus a guard, a presenter, a service and a spec for each. The samples answer through
`respond()`, acknowledge slow work with `@Defer`, and limit how often they run with `@Cooldown`.
[Project structure](guide:project-structure) walks through the files.

### The token and the test server

`meocord.config.ts` reads the token from `DISCORD_TOKEN` in the environment, and loads `.env` for it. The config is
committed and `.env` is ignored by git, so a token can't be pushed by accident. Building needs no token; starting does.

`.env` also takes `DEV_GUILD_ID`, a test server's ID. In development, every command is registered to that server, where
a change shows at once; without it, commands are registered globally, where Discord can take a while to show them. See
[Slash commands](guide:slash-commands).

### Development and production

```bash
npx meocord start --dev           # build in development mode, then rebuild and restart on every change
npx meocord start --build --prod  # a production build, then start it
npx meocord start --prod          # start the last production build
```

`--dev` watches the source and `meocord.config.ts`. A change rebuilds the bot, stops the running one, and starts the new
one once the old one has exited. If the bot can't log in, as with a token Discord refuses, the
session stops, since no code change fixes that.

## Gotchas

- **The samples ask for the Message Content intent,** which is privileged. Turn it on in the Developer Portal, under
  your application's **Bot** page, or the login is refused with a message that names it. A bot that reads no message
  text can drop `GatewayIntentBits.MessageContent` from `src/app.ts` instead.
- **A command registered globally can take a while to appear.** Set `DEV_GUILD_ID` while you develop.
- **`meocord start --prod` runs what was built last.** Add `--build`, or run `meocord build --prod` first, after a
  change.

## Build it

This guide builds one bot across its chapters: a feedback bot. A member runs `/feedback` and fills in a form, the bot
posts it for the staff with **Approve** and **Reject** buttons, and the author is told the verdict.

Create its project, and start it in your test server:

```bash
npx {{meocord}} create feedback-bot
cd feedback-bot
cp .env.example .env         # DISCORD_TOKEN, and your test server's ID in DEV_GUILD_ID
npx meocord start --dev
```

The bot comes online in your test server, and `/sample-slash` answers. Keep it running: each chapter's changes rebuild
and restart it.

## Next steps

- [Your first command](guide:first-command): write a slash command, its service and its test.
- [Project structure](guide:project-structure): what each file in the project is for.
- [Configuration](guide:configuration): everything `meocord.config.ts` sets.
