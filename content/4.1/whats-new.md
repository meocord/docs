---
id: whats-new
title: What's new in 4.1
section: Start
order: 4
since: 4.1.0
---

4.1 is a minor release: a 4.0 bot and its tests build and run without edits. A few fixes change what a bot
does at runtime; [Upgrading from 4.0 to 4.1](/docs/4.1/migrating#upgrading-from-40-to-41) lists each, with
what to check. Every release's notes are in the [changelog](/docs/4.1/changelog).

## Answering Discord

- **`respond(interaction)`** is one place to answer an interaction: it acknowledges, sends, follows up and
  reports errors in whichever form the interaction's state allows. See
  [Answering with respond()](/docs/4.1/responses).
- **`@Defer()`** acknowledges an interaction before its guards run, so slow guards and handlers never miss
  Discord's three seconds, and can lock a message's controls while the handler works. See
  [@Defer](/docs/4.1/defer).
- **Presenters** style the answers MeoCord sends itself, such as errors and cooldown notices. See
  [Presenters](/docs/4.1/presenters).
- **Localisation** translates commands and replies from typed catalogs, with keys, parameters and plurals
  checked at compile time. See [Localisation](/docs/4.1/localisation).

## Handling a call

Every handler runs through one pipeline, described in [How a call runs](/docs/4.1/how-a-handler-runs):

- **Global guards** in `@MeoCord({ guards })`, guards that read typed handler metadata through
  `ExecutionContext`, and `GuardDeniedError` to tell the user why. See [Guards](/docs/4.1/guards).
- **Interceptors** around a handler, for timing, logging, caching or mapping errors. See
  [Interceptors](/docs/4.1/interceptors).
- **Exception filters** decide what happens when a handler, its interceptors or its guards throw. See
  [Exception filters](/docs/4.1/exception-filters).
- **Validation and pipes** check a handler's input against a schema and transform it. See
  [Validation and pipes](/docs/4.1/validation).
- **`@Cooldown`** limits how often a handler runs, per user, channel, guild or globally. See
  [Cooldowns](/docs/4.1/cooldowns).

## Beyond commands

- **Gateway events** with `@On` and `@Once`, through the same pipeline. See
  [Gateway events](/docs/4.1/gateway-events).
- **Lifecycle hooks**: `onReady` and `onShutdown`, in dependency order. See
  [Lifecycle hooks](/docs/4.1/lifecycle-hooks).
- **Handler discovery**: `HandlerRegistry` lists every handler, for a `/help` command. See
  [Handler discovery](/docs/4.1/handler-discovery).
- **Providers**, new in 4.1.0-beta.3: `@MeoCord({ providers })` supplies values, classes and sync or async
  factories under a class, a string, a symbol or a `createToken` token, injected with `@Inject(token)`. See
  [Providers](/docs/4.1/services#providers).

## Shipping

- **Command registration** is configurable: registered globally or to guilds, to a development guild under
  `--dev`, at startup or only with the new `meocord register`. See
  [Registering commands](/docs/4.1/command-registration).
- **Sharding**, in one process or a process per shard, with `ShardContext.call` to reach every shard. See
  [Sharding](/docs/4.1/sharding).
- **`optionalExternals`** for packages a dependency tries to load and runs without. See
  [Self-contained builds](/docs/4.1/self-contained-builds).
- **Explained startup errors**: `isExplainedError(error)` tells whether MeoCord already said what went wrong,
  such as a privileged intent Discord refused. See [Gateway events](/docs/4.1/gateway-events).
- **Import cycles**, from 4.1.0-beta.3, are a lint warning in `meocord/eslint`, and a constructor parameter
  with no runtime type stops startup with an error that names the classes involved. See
  [ESLint](/docs/4.1/eslint#import-cycles).

## Testing

- **`invoke`** runs a handler through everything dispatch runs around it, and `getResponse` reports what it
  sent to Discord. See [Running a handler with invoke](/docs/4.1/invoke).
- **`inspectHandler`** lists what a handler is set up with, and `module.emit` sends a gateway event. See
  [Testing](/docs/4.1/testing).
- **Mocks** take `authorizingIntegrationOwners` as the plain map Discord sends, for testing each install
  context. From 4.1.0-beta.3 they also carry a `locale` and `guildLocale`, and resolve the methods that
  return a promise in discord.js. See [Mocks](/docs/4.1/mocks).
- **`clearAllMocks()` and `resetAllMocks()`**, new in 4.1.0-beta.3, reach every mock `meocord/testing` makes,
  and new projects reset them after every test. See
  [Resetting between tests](/docs/4.1/mocks#resetting-between-tests).

Every option `meocord.config.ts` takes, with its default and the version it arrived in, is in the
[meocord.config.ts reference](/docs/4.1/config-reference).
