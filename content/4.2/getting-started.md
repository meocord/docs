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

The `create` command writes a project that runs as it is: a sample of the common kinds of
[handler](guide:glossary#handler), a spec beside each, and the scripts to build, test and lint it. You give it a bot
token, and `meocord start --dev` puts it online, rebuilding and restarting as you edit.

## When to use it

Start here for a new bot. To move a discord.js bot to MeoCord, create the project the same way and bring its commands
over one [controller](guide:glossary#controller) at a time; [Coming from discord.js](guide:coming-from/discordjs) shows
how each part maps.

You need:

- **A runtime:** Node.js 22.13 or newer, or Bun 1.x.
- **A package manager:** npm, yarn, pnpm or bun.
- **A Discord application** with a bot, and its token, from the
  [Discord Developer Portal](https://discord.com/developers/applications).
- **A server to test in,** where you can add the bot.

`discord.js` 14.27 or a later 14.x and `dotenv` 18.0.5 or a later 18.x are peer dependencies, which the `create` command
installs; a bot on an older discord.js 14 or dotenv 18 upgrades them with MeoCord. TypeScript comes with the project,
and 5.0 or newer works. Keep `skipLibCheck` on, as generated projects have it: discord.js's own dependencies don't
typecheck without it.

## Example

```bash
npx {{meocord}} create my-bot
cd my-bot
cp .env.example .env         # then put your bot token in DISCORD_TOKEN
npx meocord start --dev      # development, rebuilding and restarting on every change
```

The CLI asks which package manager to use, or takes it as a flag: `--use-npm`, `--use-yarn`, `--use-pnpm` or
`--use-bun`. The project's folder and package are named after the argument, in kebab case, and depend on the MeoCord
version that created it, as a `^` range. `create` runs before there is a project, so it names the package to install,
`{{meocord}}`. Inside the project, `npx meocord` runs the version the project installed.

## How it works

### What the project starts with

A working example of the common kinds of handler: a slash command, a button, a select menu, a modal, a context menu, a
message handler and a reaction handler, plus a [guard](guide:glossary#guard), a [presenter](guide:glossary#presenter), a
service and a spec for each. The interaction samples answer through `respond()`, acknowledge slow work with `@Defer`,
and limit how often they run with `@Cooldown`. [Project structure](guide:project-structure) walks through the files.

### The token and the test server

`meocord.config.ts` reads the token from `DISCORD_TOKEN` in the environment, which it fills from the `.env` files:
`.env.<mode>.local`, `.env.local` (not under `test`), `.env.<mode>` and `.env`, the first to set a variable winning, and
a value set in the shell winning over all of them. The config is committed and every `.env` file but `.env.example` is
ignored by git, so a token can't be pushed by accident. Building needs no token; starting does.

`.env` also takes `DEV_GUILD_ID`, a test server's ID. In development, every command is registered to that server, where
a change shows at once; without it, commands are registered globally, where Discord can take a while to show them. See
[Slash commands](guide:slash-commands).

### Development and production

```bash
npx meocord start --dev           # build in development mode, then rebuild and restart on every change
npx meocord start --build --prod  # a production build, then start it
npx meocord start --prod          # start the last production build
```

`--dev` watches the source, `meocord.config.ts`, `tsconfig.json` and the `.env` files (`.env`, `.env.local`,
`.env.development`, `.env.development.local`). A change rebuilds the bot, stops the running one, running its
`onShutdown` hooks as Ctrl+C does, and starts the new one once the old one has exited; a change to one of the `.env`
files restarts it without a rebuild. If
the bot can't log in, as with a token Discord refuses, watch mode says so and keeps watching: fix the token in `.env`,
or the code, and it starts the bot again.

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
