---
id: security
title: Security
section: Shipping
order: 65
since: 4.1.0
---

A bot acts with its own permissions, on behalf of anyone who can use its commands. This page collects what
keeps that safe: the token, the permissions it asks for, who may run what, and how it treats what members
send it.

## The token

The token is the bot's password: anyone who has it can act as the bot in every server it is in.

- Keep it in the environment. `meocord.config.ts` reads `process.env.DISCORD_TOKEN`, and the generated
  `.gitignore` leaves every `.env` file except `.env.example` out of git.
- Never paste it into code, a Dockerfile, a build argument, an issue or a log. Tests need no token.
- If it leaks, reset it in the [Developer Portal](https://discord.com/developers/applications), under
  **Bot**. The old token stops working at once. Update the environment and restart.

## Ask for little

- **Intents.** List only the intents the bot uses. The privileged ones, Message Content, Server Members and
  Presence, are switched on in the Developer Portal, and a bot in 100 or more servers needs Discord's
  approval for them.
- **Permissions.** Invite the bot with the permissions its commands use, never Administrator. A bot with
  Administrator that is tricked into acting does so with every permission a server has.
- **Mentions.** Tell discord.js who a message may ping. A client-wide default is a line in the app:

::example{file="security/app.ts" region="app"}

## Who may run a command

`setDefaultMemberPermissions` on a builder decides who sees a command by default, but a server's admins can
change that under **Server Settings → Integrations**, for any command. Treat it as a default, and check what
a command needs when it runs. A guard does this once for every command that asks:

::example{file="security/permission.guard.ts" region="guard"}

The command keeps its default for the menu, and the guard enforces it:

::example{file="security/say.builder.ts" region="builder"}

`interaction.memberPermissions` is `null` outside a server, so the guard refuses those calls too.
`setContexts(InteractionContextType.Guild)` keeps the command out of DMs in the first place.

## Components carry no authority

A button's custom ID is written by the bot, but anyone who can see the message can click it. Before a button
acts for someone, check who clicked: a guard that compares the clicking user with the id the custom ID
carries, such as [`OwnerGuard`](/docs/4.1/recipe-pagination#the-handlers) in the pagination recipe, or one that checks a role, as the tutorial's
[staff guard](/docs/4.1/tutorial-guards) does. Keep secrets out of custom IDs; they are visible to anyone who
inspects the message.

A select menu's values are what the client sent. Act only on values the bot offered, as the
[select menu recipe](/docs/4.1/recipe-select-menus) does.

## What members send

Treat every option, modal field and message as untrusted:

- **Limit it.** `setMaxLength` on string options and text inputs, and `setMinValue` and `setMaxValue` on
  numbers, have Discord refuse what does not fit. [Validation](/docs/4.1/validation) checks the rest before
  the handler runs.
- **Echo it without pings.** Text a member wrote can hold `@everyone` or a role mention. Posting it with
  `allowedMentions: { parse: [] }` shows it as written and pings no one:

::example{file="security/say.controller.ts" region="controller"}

- **Never run it.** No `eval`, no shell command built from input. Pass values to a database as
  parameters, as the [database recipe](/docs/4.1/recipe-database) does, never by joining them into the
  query.

The test proves both the refusal and the absence of pings:

::example{file="security/say.controller.spec.ts" region="spec"}

## Errors and privacy

MeoCord's built-in fallback logs the full error and tells the member only that something went wrong, so a
stack trace or a query never reaches Discord. Keep it that way in your own
[exception filters](/docs/4.1/exception-filters) and guard messages: say what the member can do about it,
not how the bot failed.

Answer with anything personal privately, with `flags: MessageFlags.Ephemeral`. Log ids rather than message
content, and never log the config, which holds the token.

## Abuse

A command that is expensive, or that posts where others see it, takes a [cooldown](/docs/4.1/cooldowns).
`per: 'guild'` limits a whole server, for a command that costs the bot the same whoever runs it.

## Dependencies

Install from the lockfile with `npm ci`, keep discord.js and MeoCord up to date, and run `npm audit`, or
your package manager's equivalent, in CI. A [self-contained build](/docs/4.1/self-contained-builds) ships
exactly the packages it was built with.
