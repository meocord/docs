---
id: tutorial-shipping
title: Shipping it
section: Tutorial
order: 5.6
since: 4.1.0
---

The last step is to configure the bot for a real server, build it for production, and keep it running.

## Configure it

The bot reads three values from the environment. Put them in `.env`, which `meocord create` ignores in git:

```dotenv
DISCORD_TOKEN=your-bot-token
FEEDBACK_CHANNEL_ID=123456789012345678
STAFF_ROLE_ID=123456789012345679
```

To copy a channel's or a role's ID, turn on **Developer Mode** under Discord's **Advanced** settings, then
right-click the channel or role. `meocord.config.ts` reads the token, and `FeedbackSettings` reads the other
two. [Configuration](/docs/4.1/configuration) shows how to load a different `.env` file per environment.

Keep the token secret. Anyone who has it controls the bot. If it leaks, reset it in the
[Developer Portal](https://discord.com/developers/applications).

## Permissions

When you invite the bot, give it the `bot` and `applications.commands` scopes. In the staff channel it
needs **View Channel**, **Send Messages** and **Embed Links**. It needs no privileged intents: `Guilds` is
enough to receive interactions and to check the reviewer's roles.

The staff channel should be visible to the staff alone. The guard stops anyone else from deciding, but
anyone who can see the channel can read the feedback.

## Try it in development

```bash
npx meocord start --dev
```

Commands are registered as the bot starts. [Registering commands](/docs/4.1/command-registration) covers
registering them to one server, which updates at once while you work.

## Build and run it for production

```bash
npm ci && npx meocord build --prod
npm ci --omit=dev
npx meocord start --prod
```

The server needs `dist/`, the production `node_modules/`, `package.json`, the lockfile and `.env`.
[Deployment](/docs/4.1/deployment) covers stopping cleanly and running on Bun, and
[Self-contained builds](/docs/4.1/self-contained-builds) ships `dist/` alone.

## Where to go from here

- Keep feedback across restarts with [a database](/docs/4.1/recipe-database).
- Let members follow up in a private thread, as [the ticket system](/docs/4.1/recipe-tickets) does.
- Post a daily summary of open feedback with a [scheduled task](/docs/4.1/recipe-scheduled).
