---
id: whats-new
title: What's new in 4.2
chapter: appendix
group: help
order: 6
summary: What 4.2 adds to a 4.1 bot, area by area, the options that bring 5.0's defaults early, and what a working bot may notice.
requires: []
api:
  [
    decorators/Controller,
    decorators/MessageHandler,
    testing/MeoCordTestingModule,
    testing/useMockFn,
    testing/useStrictMocks,
    testing/createMockRawMember,
  ]
since: 4.1.0
formerly: []
---

4.2 adds to 4.1 without breaking it: a 4.1 bot and its tests build and run without edits. By default, startup errors
arrive together, a few warnings are new or say more, and customId patterns rank segment by segment, which changes the
handler only for pairs 4.1 warned about. [Upgrading from 4.1 to 4.2](guide:migrating#upgrading-from-41-to-42) lists
each, with what to check. Every release's notes are in the [changelog](guide:changelog).

## Starting the bot

- **Every startup error at once.** `MeoCordFactory.create()` and a testing module's `compile()` report every error their
  checks find, each with the file it comes from, then throw the first as before: the same error, with the same message.
  A decorator's error names the handler or class it was applied to, as `error.declaration`, and its file, as
  `error.file`. See [Every startup error at once](guide:troubleshooting#every-startup-error-at-once).
- **`startupErrors: 'all'`** in `meocord.config.ts` has decorators keep their errors too, so a bot with three mistakes
  shows all three in one run. In a test, `reportAllStartupErrors()` does the same. See
  [Configuration](guide:configuration).

## Routing

- **`@Controller({ inheritedRoutes: 'replace' })`** makes a handler the class re-decorates answer only the routes the
  class declares for it, dropping the ones a base class declares for that method. See
  [A subclass's routes](guide:how-a-call-runs#a-subclasss-routes).
- **customId patterns rank segment by segment**, the way most routers rank paths: at the first segment where one
  pattern is literal and the other a param, the literal one runs, whatever the listing. Only pairs 4.1's startup warning
  named can change handler. `findRouteConflicts` lists only the pairs still tied, and `resolveRoute`'s `alsoMatches`
  the patterns that lost. See [Overlapping patterns](guide:components#overlapping-patterns).
- **`{id:snowflake}` and `{id:uuid}`** are customId param types for a Discord ID and a UUID, which the handler gets as
  text and `route().build()` checks. Use `snowflake` for a Discord ID: `{id:number}` rounds one. See
  [Typed params](guide:components#typed-params).

## Message commands

- **`messages: { handlers: 'concurrent' }`** runs a message's command and its listeners side by side, so a slow command
  no longer holds back logging and moderation. See
  [Running them side by side](guide:message-commands#running-them-side-by-side).
- **A slow handler** that holds listeners back for 5 seconds or more is named in a warning, once, with the option that
  frees them. `slowHandlerWarning: false` turns it off.

## Testing

- **`useMockFn(vi.fn)`** has every mock from `meocord/testing` made with your test runner's own mock function, so
  `clearMocks`, `mockReset` and `vi.mocked` reach them. A new project's setup file calls it. See
  [Your test runner's mocks](guide:mocks#your-test-runners-mocks).
- **`useStrictMocks()`** has mocks compute what discord.js computes, such as whether a message is `editable` or a member
  `kickable`, where they read a placeholder otherwise. A new project's setup file calls it. See
  [Strict mocks](guide:mocks#strict-mocks).
- **`createMockRawMember()`** builds the member Discord sends from a server the bot isn't in, to test a user-installed
  command there. See [A server the bot isn't in](guide:mocks#a-server-the-bot-isnt-in).

## Getting ready for 5.0

Three options bring a 5.0 default into 4.2, so a bot can move to it one change at a time: `inheritedRoutes: 'replace'`,
`startupErrors: 'all'` and `useStrictMocks()`. Where the default would change what a bot
does, a warning says so and names the option, and 4.2 behaves as 4.1 until you set it.
