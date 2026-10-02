---
id: security
title: Security
chapter: shipping
order: 5
summary: Keep the token secret, ask for few permissions, check who may run a command, and distrust what members send.
learn:
  - Keep the token out of code, images and logs, and reset it if it leaks
  - Ask for only the intents and permissions the bot uses
  - Check permissions and who clicked when a command runs
  - Treat options, fields and messages as untrusted
requires: [guards, validation, deployment]
api: [decorators/UseGuard, decorators/Cooldown]
since: 4.1.0
---

A bot acts with its own permissions, on behalf of anyone who can use its commands. This page collects what keeps that
safe: the token, the permissions it asks for, who may run what, and how it treats what members send it.

## When to use it

Before the bot joins servers you don't run, and whenever a command acts for someone: bans, posts, reads or writes data.
Most of it is a line or a guard; the rest is a habit.

## Example

A guard checks, when a command runs, that the member holds the permissions it needs:

::example{file="security/permission.guard.ts" region="guard"}

The command keeps its default for the menu, and the guard enforces it:

::example{file="security/say.builder.ts" region="builder"}

`setDefaultMemberPermissions` decides who sees a command by default, but a server's admins can change that under
**Server Settings → Integrations**, for any command. Treat it as a default, and check what a command needs when it
runs, as the guard does.

## How it works

The guard runs before the handler, as [every guard](guide:guards) does, and refuses the call when a permission is
missing. `interaction.memberPermissions` is `null` outside a server, so the guard refuses those calls too;
`setContexts(InteractionContextType.Guild)` keeps the command out of DMs in the first place.

## The token

The token is the bot's password: anyone who has it can act as the bot in every server it's in.

- **Keep it in the environment.** `meocord.config.ts` reads `process.env.DISCORD_TOKEN`, and a new project's
  `.gitignore` leaves every `.env` file except `.env.example` out of git.
- **Never paste it** into code, a Dockerfile, a build argument, an issue or a log. Tests need no token.
- **If it leaks, reset it** in the [Developer Portal](https://discord.com/developers/applications), under **Bot**. The
  old token stops working at once; update the environment and restart.

## Ask for little

- **Intents.** List only the intents the bot uses. The privileged ones, Message Content, Server Members and Presence,
  are switched on in the Developer Portal, and a bot in 100 or more servers needs Discord's approval for them.
- **Permissions.** Invite the bot with the permissions its commands use, never Administrator. A bot with Administrator
  that's tricked into acting does so with every permission a server has.
- **Mentions.** Tell discord.js who a message may ping. A client-wide default is a line in the app:

::example{file="security/app.ts" region="app"}

## Components carry no authority

A button's custom ID is written by the bot, but anyone who can see the message can click it. Before a button acts for
someone, check who clicked: a guard that compares the clicking user with the ID the custom ID carries, as in
[the pagination recipe](guide:recipes/pagination), or one that checks a role, as the feedback bot's staff guard does in
[Guards](guide:guards#build-it). Keep secrets out of custom IDs: anyone who inspects the message can read them.

A select menu's values are what the client sent. Act only on values the bot offered, as
[the select menu recipe](guide:recipes/select-menus) does.

## What members send

Treat every option, modal field and message as untrusted:

- **Limit it.** `setMaxLength` on string options and text inputs, and `setMinValue` and `setMaxValue` on numbers, have
  Discord refuse what doesn't fit. [Validation](guide:validation) checks the rest before the handler runs.
- **Echo it without pings.** Text a member wrote can hold `@everyone` or a role mention. Posting it with
  `allowedMentions: { parse: [] }` shows it as written and pings no one:

::example{file="security/say.controller.ts" region="controller"}

- **Never run it.** No `eval`, and no shell command built from input. Pass values to a database as parameters, as
  [the database recipe](guide:recipes/database) does, never by joining them into the query.

The test proves both the refusal and the absence of pings:

::example{file="security/say.controller.spec.ts" region="spec"}

## Errors, privacy and abuse

MeoCord's built-in fallback logs the full error and tells the member only that something went wrong, so a stack trace
or a query never reaches Discord. Keep it that way in your own [exception filters](guide:exception-filters) and guard
messages: say what the member can do about it, not how the bot failed.

Answer with anything personal privately, with `flags: MessageFlags.Ephemeral`. Log IDs rather than message content, and
never log the config, which holds the token.

A command that's expensive, or that posts where others see it, takes a [cooldown](guide:cooldowns). `per: 'guild'`
limits a whole server, for a command that costs the bot the same whoever runs it.

## Dependencies

Install from the lockfile with `npm ci`, keep discord.js and MeoCord up to date, and run `npm audit`, or your package
manager's equivalent, in CI. A [self-contained build](guide:self-contained-builds) ships exactly the packages it was
built with.

## Gotchas

- **`setDefaultMemberPermissions` is a default,** which a server's admins can change. Check permissions in a guard.
- **A button's custom ID says nothing about who clicked.** Compare the user, or check a role.
- **Echoing a member's text pings** whoever it mentions unless the message sets `allowedMentions`.

## Build it

The feedback bot runs on its own server. Invite it to the server where it's used, with only what it needs: the `bot` and
`applications.commands` scopes, and **View Channel**, **Send Messages**, **Embed Links** and **Read Message History** in
the review channel and wherever members mention it. It needs no privileged intents: `Guilds`, `GuildMessages` and
`GuildMessageReactions` are all it asks for.

Make the review channel visible to the staff alone. The guard stops anyone else from deciding, but anyone who can see
the channel can read the feedback.

Run `/feedback` as a member: the report reaches the review channel, and a member without the staff role neither sees
it nor can decide it.

## Next steps

- [ESLint](guide:eslint): catch mistakes, import cycles among them, as you write.
- [Guards](guide:guards): refuse a call before the handler runs, with a message for the member.
- [Cooldowns](guide:cooldowns): limit how often a command runs, per user, server or channel.
