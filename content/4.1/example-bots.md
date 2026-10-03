---
id: example-bots
title: Example bots
chapter: appendix
group: help
order: 2
summary: Whole bots built with MeoCord, what each one shows and where the Guide teaches it, and how to run one.
requires: [getting-started]
api: []
formerly: []
---

The [MeoCord examples repository](https://github.com/meocord/examples) holds whole bots, each created as a new app and
grown from there. The Guide's examples show one piece at a time; a bot shows the pieces working together, with its
tests. Every bot is tested on each change and daily, with the meocord version its lockfile pins and with the newest
release, so a release that breaks one shows up there first.

## Feedback

A feedback form a server's staff approve or reject. `/feedback` opens a form, once every five minutes for each member.
A submitted form is posted to a review channel with **Approve** and **Reject** buttons, which only members with the
staff role can use. A verdict marks the post, removes its buttons, and tells the author by direct message.

::example-bot{id="feedback"}

Besides its token, the bot needs a staff role and a channel for reviews where it can send messages: their IDs go in
`.env` as `STAFF_ROLE_ID` and `FEEDBACK_CHANNEL_ID`. Feedback is kept in memory, so a restart forgets it, and a review
button left from before the restart says the feedback is gone.

## Running a bot

Every bot runs the same way, on Node.js 22.13 or later. It needs a bot token from the
[Discord Developer Portal](https://discord.com/developers/applications), and the bot invited to a server with the `bot`
and `applications.commands` scopes.

```bash
git clone https://github.com/meocord/examples.git
cd examples/feedback
npm ci
cp .env.example .env
npm run start:dev
```

Set `DISCORD_TOKEN` and the bot's own settings in `.env`, which git ignores; never commit a token.
[The token and the test server](guide:getting-started#the-token-and-the-test-server) covers `.env` and
`DEV_GUILD_ID`. `npm run start:dev` watches the code, rebuilding and restarting the bot on each change. `npm test`
runs the bot's tests with mock interactions, with no Discord connection or token, and `npm run build:prod` followed by
`npm start` runs it as it runs in production.
