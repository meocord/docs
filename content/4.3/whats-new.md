---
id: whats-new
title: What's new in 4.3
chapter: appendix
group: help
order: 6
summary: What 4.3 adds to a 4.2 bot, area by area, the options that bring 5.0's defaults early, and what a working bot may notice.
requires: []
api:
  [
    utilities/commandMention,
    utilities/formatDuration,
    utilities/splitMessage,
    utilities/OwnerGuard,
    utilities/route,
    testing/MeoCordTestingModule,
    testing/useStrictMocks,
  ]
since: 4.1.0
formerly: []
---

4.3 adds to 4.2 without breaking a bot that only calls MeoCord's functions: a 4.2 bot and its tests build and run
without edits. A few warnings are new, the help reply splits more carefully, and code that writes a `Route` object by
hand needs a `match` method. [Upgrading from 4.2 to 4.3](guide:migrating#upgrading-from-42-to-43) lists each, with what
to check. Every release's notes are in the [changelog](guide:changelog).

## Formatting

- **`commandMention`** gives a clickable mention of one of your slash commands, its ID looked up where the reader can
  run it. See [Formatting](guide:formatting).
- **`formatDuration` and `permissionNames`** write a length of time and a list of permissions in the reader's language,
  through your app's translator. See [Writing a duration](guide:formatting#writing-a-duration) and
  [Naming permissions](guide:formatting#naming-permissions).
- **`splitMessage`, `truncate` and `DiscordLimits`** fit text to what Discord accepts, closing and reopening code cut
  across messages. See [Splitting a long message](guide:formatting#splitting-a-long-message).
- **discord.js's formatters**, such as `userMention` and `time`, are exported from `meocord/common` too, so a bot
  imports its formatting from one place. See [discord.js's formatters](guide:formatting#discordjss-formatters).

## Guards

- **`OwnerGuard`** lets only the user whose ID a component's customId carries use it, and tells anyone else why in
  their language. See [Letting only its owner use a component](guide:guards#letting-only-its-owner-use-a-component).
- **`answerDenied: true`** answers a guard's `false` on an interaction as a `GuardDeniedError`, privately, where a
  command was left unanswered. See [Refusing a call](guide:guards#refusing-a-call).
- **`globalStagesOnEvents: false`** keeps global guards and interceptors without `types` off `@On` and `@Once`
  handlers. See [Where guards apply](guide:guards#where-guards-apply).

## Lifecycle hooks

- **`waitForReady: true`** holds each call until the `onReady` hooks of the classes it uses have settled, so a handler
  can rely on a cache an `onReady` warms. See [Waiting for the hooks](guide:lifecycle-hooks#waiting-for-the-hooks).
- **`warnSlow`** names slow work: an `onReady` still running after 10 seconds, with how many hooks wait behind it, and
  an autocomplete that takes 2 of its 3 seconds. `warnSlow: false` silences them. See
  [onReady](guide:lifecycle-hooks#onready).
- **A stop while the bot starts** shuts down what the start made before `start()` rejects, and an `onShutdown` hook may
  stop its own app. See [onShutdown](guide:lifecycle-hooks#onshutdown).

## Components, themes and text

- **`route().match(customId)`** reads a customId back into the params its handler would receive, and `RouteMatch` types
  them. See [Reading a customId back](guide:components#reading-a-customid-back).
- **`bindTheme`** answers each call it wraps in the theme of the member and server it answers, so every member who
  clicks a collected button sees their own. See [Collectors and listeners](guide:theming#collectors-and-listeners).
- **`t.localizations(key, params)`** fills params into each locale's translation of a command's name or description.
  See [Choosing the language](guide:localisation#choosing-the-language).
- **`ValidationIssue.raw`** keeps what the schema reported, such as zod's `code` and `minimum`, for refusals in your
  own words. See [Validation](guide:validation#how-it-works).

## CLI and builds

- **`generate`** adds a controller or observer to `src/app.ts`, or says why it can't. See
  [Scaffolding](guide:cli#scaffolding).
- **`register --prune`** removes your commands from servers the configuration no longer names. See
  [Removing commands left in other servers](guide:cli#removing-commands-left-in-other-servers).
- **A stale build** is named when `start --prod` or `register` runs it. See
  [Development and production](guide:cli#development-and-production).
- **A self-contained build** packs every installed copy of a native addon, and each importer loads its own. See
  [Native addons and platforms](guide:self-contained-builds#native-addons-and-platforms).
- **Under Bun**, an uncaught error and `console.error(error)` name your source, as under Node. See
  [Stack traces](guide:configuration#stack-traces).

## Testing

- **Strict mocks** answer what discord.js answers: an interaction's answers resolve to its response, a mock client's
  emitter works, and collectors made on a mock collect what `dispatch` delivers. See
  [Collectors](guide:mocks#collectors).
- **`eventFallback: true`** has `emit` answer an event handler's refusals as the bot does. See
  [Invoke and dispatch](guide:invoke-and-dispatch).
- **`inspectHandler()`** reports a handler's `@Defer`, and `overrideCommandId` sets the ID `commandMention` gives. See
  [Testing](guide:testing).
- **jest** loads `meocord/testing` without Node's VM modules. See [Running tests](guide:testing#running-tests).

## Getting ready for 5.0

Five options bring a 5.0 default into 4.3, so a bot can move to it one change at a time: `allowedMentions` set to
`{ parse: [] }` in `clientOptions`, `globalStagesOnEvents: false`, and in tests `eventFallback: true`, `typedValues`
and `useStrictMocks()`. A bot or a test that leaves `allowedMentions`, `globalStagesOnEvents` or `eventFallback` unset
gets a warning naming it, where 5.0 would change what happens.
[More options that bring 5.0's defaults early](guide:migrating#more-options-that-bring-50s-defaults-early) lists the
new ones.
