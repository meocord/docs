---
id: troubleshooting
title: Troubleshooting
section: Help
order: 100
since: 4.1.0
---

The failures most bots meet, what causes each, and where the fix is explained. Messages in quotes are what
Discord's app or the bot's log shows.

## The bot will not start

**"Discord token is missing"**: `meocord start` found no `discordToken`. A generated app reads it from
`DISCORD_TOKEN` in `.env`, which [the config loads](/docs/4.1/configuration#environment-variables); check that
the file exists where the bot runs and names that variable.

**An invalid token**: Discord refused the token at login, the bot logs discord.js's error, and `start` exits
with code 1. Copy the token again from the Developer Portal, under Bot; resetting it there invalidates the old
one.

**"Discord refused the privileged intents the bot requests"**: `clientOptions.intents` asks for
`GuildMembers`, `GuildPresences` or `MessageContent`, and the application has not enabled them. Enable each in
the Developer Portal, under Bot, then Privileged Gateway Intents, as the message names them. A verified bot in
100 or more servers needs Discord's approval for them.

**`meocord.config.ts` fails to load**: `build`, `start` and `register` stop with the file and line, or with a
list of every option of the wrong type. An option MeoCord does not know, often a typo, is only a warning. See
[Configuration](/docs/4.1/configuration#options).

**"This build carries native addons compiled for …"**: a [self-contained build](/docs/4.1/self-contained-builds#native-addons)
made on one platform was started on another. Build where it runs; for a container, run `meocord build` inside
the image.

**"… cannot be created: parameter 1 of its constructor has no runtime type"**: a controller or service asks
for a parameter MeoCord cannot inject. Usually two services import each other, so the one loaded second
recorded the other's type before it existed; the error names the classes that inject it. A parameter typed
with an interface, or a type from `import type`, reads the same way. Move what both need into a third
service, or inject the parameter with `@Inject(token)`; see
[Services that need each other](/docs/4.1/services#services-that-need-each-other). `meocord/eslint` warns about
such cycles as you write them ([Import cycles](/docs/4.1/eslint#import-cycles)).

**"The factory providing … failed"**: a factory in `@MeoCord({ providers })` threw or rejected, such as a
database refusing the connection, and the bot stopped before login with the cause. Fix what the cause names;
see [Providers](/docs/4.1/services#providers).

**"… injects …, which nothing provides"**: a class injects a string or symbol token, or a `createToken` token,
that no provider supplies. Add a provider for it to `@MeoCord({ providers })`, or to the testing module's
`providers` in a test.

## A command does not show up in Discord

- **It was registered somewhere else.** Under `meocord start --dev` with `commands.developmentGuild` set,
  every command goes to that server only. In production, commands go globally, or to `commands.guilds`. See
  [Registering commands](/docs/4.1/command-registration).
- **Registration did not run.** With `commands.register: false`, only `meocord register` registers. A builder
  that throws stops registration, and the error is logged.
- **The bot is not in the server with the right scope.** An invite must include the `applications.commands`
  scope as well as `bot`.
- **The client has not caught up.** Server commands appear at once; global ones can take a while to reach
  every client. Reloading Discord (Ctrl+R, or Cmd+R) refreshes the command list.

A command you removed that still shows is a leftover in a scope this configuration no longer registers to.
The bot warns "command(s) are still registered … which this configuration does not register to";
`commands.clearOther` removes them. See [Leftover commands](/docs/4.1/command-registration#leftover-commands).

## "The application did not respond", or "This interaction failed"

Discord gives an interaction three seconds for its first answer. Nothing arrived in time:

- **The handler is slow.** A database call or an API request before the first reply can take longer than
  three seconds. Add [`@Defer()`](/docs/4.1/defer), which acknowledges before the guards run.
- **A guard returned `false`.** That stops the call without an answer, on purpose; with `@Defer` the deferred
  reply is withdrawn. To tell the user why, throw `GuardDeniedError` instead. See [Guards](/docs/4.1/guards).
- **The handler threw, and nothing answered.** MeoCord's built-in fallback answers an error no
  [exception filter](/docs/4.1/exception-filters) handles; a filter that catches an error and sends nothing
  leaves the interaction unanswered.
- **No handler matched.** A component's `customId` must match a route; see
  [Routing components](/docs/4.1/component-routing).

A test shows the guard case: the call does not run, and nothing is sent.

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="invoke"}

An autocomplete interaction cannot be deferred: it has three seconds to call `respond()`, once. Keep its
handler to a cache lookup. See [Autocomplete](/docs/4.1/autocomplete).

## Discord API errors

| Code  | Discord's message                         | What happened                                                                                                                    |
| ----- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 10062 | Unknown interaction                       | The first answer came after the three seconds. Use `@Defer()`.                                                                   |
| 40060 | Interaction has already been acknowledged | Two answers were sent as first answers, often a `reply` after a `deferReply`. [`respond()`](/docs/4.1/responses) picks the call. |
| 50027 | Invalid Webhook Token                     | A follow-up or edit came more than fifteen minutes after the interaction, when its token expires. Send a new message instead.    |
| 50001 | Missing Access                            | The bot cannot see the channel. Check its role and the channel's permissions.                                                    |
| 50013 | Missing Permissions                       | The bot can see the channel but lacks the permission the call needs, such as Manage Messages to delete one.                      |

A test can make a mock reject with any of them through `createDiscordError(code)`; see
[Mocks](/docs/4.1/mocks#discords-errors).

## Messages and reactions

- **`@MessageHandler` never runs.** The bot needs the `GuildMessages` intent, and `MessageContent`, which is
  privileged, to read what a message says. Messages from bots and messages with no text are skipped, and a
  keyword matches the whole message, trimmed and case-sensitive. See
  [Messages and reactions](/docs/4.1/messages-and-reactions#intents).
- **Reactions on older messages are missed.** Add the `Message` and `Reaction` partials to `clientOptions`.
- **`@On(event)` never runs.** Most events need an intent; the bot warns at startup, "The … intent is not in
  clientOptions.intents", naming the handler. See [Gateway events](/docs/4.1/gateway-events).

## Sharding

- **The bot refuses to start with two classes of the same name.** With process sharding, `ShardContext.call`
  finds a class by name in each process, so no two controllers or services may share one; in any mode, `@Once`
  tells classes apart by name. Rename one.
- **One-off work runs once per shard.** Guard it with `onReady`'s `primary`, which is `true` only in the
  process running shard 0. See [Sharding](/docs/4.1/sharding#a-process-per-shard).
- **A shard keeps restarting.** The manager restarts a shard that exits, backing off to a minute; one that
  cannot log in because of the token or its intents stops the bot instead. Read the shard's first error in the
  log.
