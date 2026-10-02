---
id: troubleshooting
title: Troubleshooting
chapter: appendix
group: help
order: 2
summary: The failures most bots meet, what the bot or Discord says for each, what causes it, and where the fix is.
requires: []
api: [responses/GuardDeniedError, decorators/Defer, testing/createDiscordError]
since: 4.1.0
formerly: []
---

The failures most bots meet, what causes each, and where the fix is explained. Text in quotes is what Discord's app
or the bot's log shows.

## The bot won't start

**"Discord token is missing: meocord.config.ts sets discordToken, and a new app reads it from DISCORD_TOKEN in
.env."** The config gives no token. Check that `.env` exists where the bot runs, from its working directory, and
names `DISCORD_TOKEN`. See [Environment variables](guide:configuration#environment-variables).

**"Discord refused the bot token."** Discord refused the token at login, so `start()` rejects and the process exits
with code 1. Copy the token again from the Developer Portal, under your application, Bot, then Reset Token.
Resetting it there makes the old one stop working.

**"Discord refused the privileged intents the bot requests (…)"** `clientOptions.intents` asks for
`GuildMembers`, `GuildPresences` or `MessageContent`, and the application hasn't enabled them. Enable each one the
message names in the Developer Portal, under Bot, then Privileged Gateway Intents. A verified bot in 100 or more
servers needs Discord's approval for them. See [Intents](guide:gateway-events#intents).

**"Discord refused the intents the bot requests as invalid."** A value in `clientOptions.intents` isn't one of
discord.js's `GatewayIntentBits`.

**`meocord.config.ts` doesn't load.** `build`, `start` and `register` stop with the file and line, or with a list
of every option of the wrong type. An option MeoCord doesn't know, often a typo, is only a warning. See
[Configuration](guide:configuration#options).

### One line naming a class, and exit code 1

MeoCord refuses a mistake it can see as the bot loads, and reports it as one line that starts with what it is on:
`Class.method:`, `Class:`, `App:` for `@MeoCord`'s options, `meocord.config.ts:` for its settings, or the build's
folder, such as `dist:`. The rest names the decorator and the problem, such as:

```text
SampleButtonController.handleButtonWithId: Invalid pattern "button-with-{ownerId}": {ownerId} must occupy a whole segment, …
```

Fix what it names. The common ones:

- **"`Class`: parameter 1 of its constructor has no runtime type, so it cannot be created."** A controller or
  service asks for a parameter MeoCord can't inject. Usually two classes import each other, and the message names
  the class that injects it. A parameter typed with an interface, or with an `import type`, reads the same way.
  Move what both need into a third service, or inject the parameter with `@Inject(token)`. `meocord/eslint` warns
  about such cycles as you write them; see [Import cycles](guide:eslint#import-cycles).
- **"`Class`: it injects …, which nothing provides"** A class injects a string, symbol or `createToken` token that
  no provider supplies. Add a provider for it to `@MeoCord({ providers })`, or to the testing module's `providers`
  in a test. See [Providers](guide:services#providers).
- **"`Class`: two classes have this name; …"** MeoCord tells these classes apart by name, and the rest of the line
  says why:

  ```text
  Shop: two classes have this name; @Cooldown and @Once tell classes apart by name, so they would share their counts. Rename one of them.
  ```

  Two classes of one name are refused when either uses `@Cooldown` or `@Once`, in any mode. With process sharding,
  any two controllers or services are, since `ShardContext.call` finds a service in another shard by its class name.
  Rename one of the classes.

- **"`Class.method`: @MessageHandler('…'): …"** A message pattern MeoCord can't read stops the bot there, such as a
  rest that isn't last, a type nothing adds, a name used twice, or braces inside a word. So does `scope: 'dm'` on a
  command with a `member`, `role` or `channel` param. Two patterns that match the same messages stop it too, with a
  line naming both handlers and their patterns, such as
  `A.swap: "swap {a}" and "swap {b}" in B.swap match the same messages, …`. See
  [Errors at startup](guide:message-commands#errors-at-startup), which lists each one.
- **"`Class.method`: "…" and "…" in `Other.method` match the same … customIds"** Two component handlers of one
  type take the same ids, so only one could ever run. `MeoCordFactory.create()`, `meocord register` and
  `MeoCordTestingModule.compile()` refuse them, `register` before it sends any command. Change one pattern; see
  [Overlapping patterns](guide:components#overlapping-patterns).
- **"`Class.method`: @Validate and @UsePipe are for interaction and patterned message handlers, …"** They check a
  handler's options, customId params, modal fields or pattern params, and a message handler without a pattern, a
  reaction, autocomplete or event handler has none. `@Cooldown` on a reaction, autocomplete or event handler is
  refused the same way, "`@Cooldown` is for interaction and message handlers"; on the controller, it skips them.
- **"`Class`: not decorated with @MeoCord(), so there is no app to create."** The class given to
  `MeoCordFactory.create()`, usually in `src/main.ts`, has no `@MeoCord`.
- **"meocord.config.ts: sharding.mode 'process' starts one shard per process, …"** With process sharding,
  `clientOptions.shards` and `shardCount` must be unset. Otherwise, set there, they must agree with
  `sharding.shards`, or the line reads "sharding.shards (…) and clientOptions.shards/shardCount disagree"; set the
  shards in one place. See [Sharding](guide:sharding).
- **"dist: this build carries native addons compiled for …, but is running on …"** A
  [self-contained build](guide:self-contained-builds#native-addons-and-platforms) made on one platform was started
  on another. Build where it runs; for a container, run `meocord build` inside the image.
- **A builder that fails.** A command's builder runs as its class loads, so a name Discord refuses, such as one
  with a capital letter or a space, stops the bot there, naming the builder and the command. See
  [Your first command](guide:first-command#gotchas).

### Other startup errors

What MeoCord can't see as the bot loads, such as a provider that fails, reaches the generated `main.ts`, which logs
it as "Error during startup:" with the error, and the process exits 1.

**"The factory providing … failed: …"** A factory in `@MeoCord({ providers })` threw or rejected, such as a database
refusing the connection, so the bot stopped before login with the cause. Fix what the cause names; see
[Providers](guide:services#providers).

## A command doesn't show up in Discord

- **It was registered somewhere else.** Under `meocord start --dev` with `commands.developmentGuild` set, every
  command goes to that server only. Otherwise commands go globally, or to `commands.guilds`. See
  [Registering commands](guide:slash-commands#registering-commands).
- **Registration didn't run.** With `commands.register: false`, only `meocord register` registers. A builder whose
  `toJSON()` throws, such as a slash command without a description, stops that start's registration with an error
  naming it, and no command is sent; see
  [the upgrade note](guide:migrating#a-command-builder-that-throws-stops-registration). A failed registration is
  logged, and the bot stays online.
- **The bot isn't in the server with the right scope.** An invite must include the `applications.commands` scope as
  well as `bot`.
- **The client hasn't caught up.** Server commands appear at once; global ones can take a while to reach every
  client. Reloading Discord, with Ctrl+R or Cmd+R, refreshes the command list.

A command you removed that still shows is a leftover in a scope this configuration doesn't register to. The bot
warns "… command(s) are still registered … which this configuration does not register to", and
`commands.clearOther` removes them.

## "The application did not respond"

Discord gives an interaction three seconds for its first answer, and nothing arrived in time:

- **The handler is slow.** A database call or an API request before the first reply can take longer than three
  seconds. Add [`@Defer()`](guide:defer), which acknowledges first.
- **A guard returned `false`.** That stops the call without an answer, on purpose. Under `@Defer`, a command's
  deferred reply is deleted. To tell the user why, throw
  [`GuardDeniedError`](api:responses/GuardDeniedError) instead. See [Guards](guide:guards).
- **An exception filter caught the error and sent nothing.** MeoCord's built-in fallback answers an error no
  [exception filter](guide:exception-filters) handles, but a filter that handles one and sends nothing leaves the
  interaction unanswered.
- **The handler never answered.** In development, MeoCord warns once for each handler that ends without answering,
  or defers and never follows up, and names it. An interceptor that returned before the handler ran or finished is
  named instead: "Shop.buy: its interceptor Cached returned before the handler ran, without answering the
  interaction, …". See [Responses](guide:responses#gotchas).

A test shows the guard case: the call doesn't run, and nothing is sent.

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="invoke"}

A button, select menu or modal that no route takes is answered "Command not found!", and the log names its
`customId`. See [When nothing matches](guide:components#when-nothing-matches).

An autocomplete interaction can't be deferred: it has three seconds to answer, once. Keep its handler to a cache
lookup. See [Autocomplete](guide:autocomplete#gotchas).

## Discord API errors

| Code  | Discord's message                         | What happened                                                                                                                      |
| ----- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 10062 | Unknown interaction                       | The first answer came after the three seconds. Use `@Defer()`.                                                                     |
| 40060 | Interaction has already been acknowledged | Two answers were sent as first answers, often a `reply` after a `deferReply`. [`respond()`](guide:responses) picks the right call. |
| 50027 | Invalid Webhook Token                     | A follow-up or an edit came more than fifteen minutes after the interaction, when its token expires. Send a new message instead.   |
| 50001 | Missing Access                            | The bot can't see the channel. Check its role and the channel's permissions.                                                       |
| 50013 | Missing Permissions                       | The bot can see the channel but lacks the permission the call needs, such as Manage Messages to delete one.                        |

A test can make a mock reject with any of them through [`createDiscordError(code)`](api:testing/createDiscordError);
see [Discord's errors](guide:mocks#discords-errors).

## Messages and reactions

- **A message command never runs.** The bot needs the `GuildMessages` intent, and `MessageContent`, which is
  privileged, to read a message's text; the bot warns at startup when it's missing. Messages from bots never reach
  a handler. A pattern matches after the app's prefix, or the handler's own, and only the most specific matching
  pattern runs. See [Which handler runs](guide:message-commands#which-handler-runs).
- **Reactions are missed.** Reactions need the `GuildMessageReactions` intent, or `DirectMessageReactions` in DMs.
  For reactions on messages sent before the bot started, add the `Message` and `Reaction` partials. See
  [Reactions](guide:reactions#gotchas).
- **`@On(event)` never runs.** Most events need an intent. The bot warns at startup, "The … intent is not in
  clientOptions.intents, so Discord will not send what … handles", naming the handler. See
  [Intents](guide:gateway-events#intents).

## Sharding

- **One-off work runs once per shard.** Guard it with `onReady`'s `primary`, which is `true` only in the process
  running shard 0. See [A process per shard](guide:sharding#a-process-per-shard).
- **A shard keeps restarting.** The manager restarts a shard that exits, waiting longer each time up to a minute.
  One that can't log in because of the token or its intents stops the bot instead. Read the shard's first error in
  the log.
