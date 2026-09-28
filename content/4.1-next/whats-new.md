---
id: whats-new
title: What's new in 4.1
chapter: appendix
group: help
order: 5
summary: What 4.1 adds to a 4.0 bot, area by area, and where the few changes a working bot may notice are listed.
requires: []
api: [responses/respond, decorators/Defer, decorators/MessageHandler, decorators/Cooldown, testing/MeoCordTestingModule]
since: 4.1.0
formerly: []
---

4.1 adds to 4.0 without breaking it: a 4.0 bot and its tests build and run without edits. A few fixes change what a
bot does at runtime, and [Upgrading from 4.0 to 4.1](guide:migrating#upgrading-from-40-to-41) lists each, with what to
check. Every release's notes are in the [changelog](guide:changelog).

> [!NOTE]
> 4.1 is in beta. This page describes 4.1.0-beta.8, and a later beta may still change a detail before 4.1.0 is
> released.

## Answering Discord

- **`respond(interaction)`** is one place to answer an interaction. It acknowledges, sends, follows up and reports
  errors in whatever form the interaction's state allows. See [Responses](guide:responses).
- **`@Defer()`** acknowledges an interaction first, so slow stages and handlers never miss Discord's three seconds,
  and locks a message's controls while the handler works. See [@Defer](guide:defer).
- **Presenters** decide how MeoCord's own answers look: the loading view, error answers and the built-in `!help`. See
  [Presenters](guide:presenters).
- **Themes** name the colours, emojis and button styles those answers use by what they mean. `Theme` is deprecated,
  and its colours changed; see [the upgrade note](guide:migrating#theme-is-deprecated-and-its-colours-changed) and
  [Theming](guide:theming).
- **Localisation** translates commands and replies from typed catalogs, and MeoCord's own texts too, with keys,
  params and plurals checked when the code compiles. See [Localisation](guide:localisation).

## Handling a call

Every handler runs through one pipeline, in a fixed order. See [How a call runs](guide:how-a-call-runs).

- **Guards** can be global, in `@MeoCord({ guards })`, read typed facts about the handler through `ExecutionContext`,
  and throw `GuardDeniedError` to tell the user why. See [Guards](guide:guards).
- **Interceptors** run around a handler, for timing, logging, caching or mapping errors. See
  [Interceptors](guide:interceptors).
- **Exception filters** decide what the user is told when a call throws, and **`UserError`** tells the user about
  their own mistake, privately. See [Exception filters and UserError](guide:exception-filters).
- **Validation and pipes** check a handler's input against any Standard Schema and turn it into what the handler
  wants. See [Validation and pipes](guide:validation).
- **`@Cooldown`** limits how often a handler runs, per user, channel, server, everyone, or a value of the call with
  `by`. Counts can live in the shard manager, Redis or a database of your own. See [Cooldowns](guide:cooldowns) and
  [Cooldown stores](guide:recipes/cooldown-stores).
- **Observers** are told as each call starts and once it settles, with how it ended and how long it took, for metrics,
  audit logs and tracing. See [Observers](guide:observers).
- **Class stages** on a controller cover the handlers its subclasses declare, and class guards cover its autocomplete
  handlers. See [the upgrade notes](guide:migrating#class-guards-now-cover-inherited-handlers).

## Beyond slash commands

- **Components** route by `customId` pattern, with typed params such as `{count:int}`, and `route()` builds the ids a
  pattern matches. A select menu's choices arrive in its params. See
  [Buttons, selects and modals](guide:components).
- **Context menus** type the interaction a handler receives from its builder. See
  [Context menus](guide:context-menus).
- **Message commands**: `@MessageHandler('roll {sides:int}')` matches a message word by word after a prefix or a
  mention, with typed params, flags, aliases, usage replies and a built-in `!help`. A message command can tell its
  author about an error or a cooldown in a direct message, with `messages.dmOnError` and `messages.dmOnCooldown`. See
  [Message commands](guide:message-commands) and [Message params](guide:message-params).
- **Reactions** route by emoji name or id, and never reach a handler from a bot. See [Reactions](guide:reactions).
- **Gateway events** with `@On` and `@Once`, through the same pipeline. See [Gateway events](guide:gateway-events).
- **Lifecycle hooks**: `onReady` and `onShutdown`, in dependency order. See [Lifecycle hooks](guide:lifecycle-hooks).
- **Providers** supply values, classes and async factories under a token, injected with `@Inject(token)`. See
  [Providers](guide:services#providers).
- **Handler discovery**: `HandlerRegistry` lists every handler, for a help command. See
  [Handler discovery](guide:handler-discovery).

## Building and shipping

- **Command registration** is configurable: globally or to servers, to a development server under `--dev`, at startup
  or only with `meocord register`. See [Registering commands](guide:slash-commands#registering-commands).
- **Sharding**, in one process or a process per shard, with `ShardContext.call` to reach every shard. See
  [Sharding](guide:sharding).
- **Self-contained builds** pack native addons into `dist`, and run on Bun as on Node.js. `optionalExternals` covers
  packages a dependency tries to load and runs without. See [Self-contained builds](guide:self-contained-builds).
- **`logLevel`** in `meocord.config.ts`, or `MEOCORD_LOG_LEVEL` for one run, sets which lines the logger prints. See
  [Logging](guide:configuration#logging).
- **Mistakes MeoCord refuses as the bot loads**, such as an invalid pattern or two handlers for one command, are
  reported as one line that names the class and method, and the bot exits 1.
- **`start --dev`** rebuilds and restarts on changes to the source, `meocord.config.ts` and `tsconfig.json`, one bot
  at a time. See [The CLI](guide:cli#development-and-production).
- **Import cycles** are a lint warning in `meocord/eslint`. See [ESLint](guide:eslint#import-cycles).

## Testing

- **`invoke` and `dispatch`** run a handler through everything the bot runs around it, and `getResponse` reports what
  it sent. See [Invoke and dispatch](guide:invoke-and-dispatch).
- **`MeoCordTestingModule.fromApp(App)`** builds a module from the whole app, wired as the bot wires it. See
  [Testing the whole app](guide:testing#testing-the-whole-app).
- **Lifecycle hooks and gateway events** run in a test with `module.init()` and `module.emit()`. See
  [Testing](guide:testing).
- **Mocks** read the data Discord always sends as Discord sends it, including locales and install contexts, and take
  values for their properties. See [Mocks](guide:mocks).
- **`testCooldownStore`** checks a cooldown store you write against the built-in one's behaviour. See
  [Checking a store](guide:recipes/cooldown-stores#checking-a-store).
