---
id: testing-recipes
title: Testing themes, guards and cooldowns
chapter: testing
order: 4
summary: Test what a theme gives a handler, why a guard refused, when a cooldown lets a user in, and what fails.
learn:
  - Change a theme for one module, and run a service in a theme
  - Test a guard alone and read what a handler is set up with
  - Move a cooldown along with fake timers
  - Test what the member sees when something fails
requires: [testing, invoke-and-dispatch]
api:
  [
    testing/createMockTheme,
    testing/withTheme,
    testing/createExecutionContext,
    testing/inspectHandler,
    testing/testCooldownStore,
    testing/createDiscordError,
  ]
since: 4.1.0
covers: [4.0/testing]
---

Most handler tests are an `invoke` and a look at `getResponse`. Some parts of a bot need a little more: a theme that
changes per server, a guard that reads the handler's metadata, a cooldown that only lets a user in after time has
passed, and the answers a member gets when something goes wrong.

This page collects the patterns for each.

## When to use it

Reach for these when a test depends on more than the handler's input:

- the **theme** the handler answers in, or that a service reads with `useTheme()`;
- a **guard**'s decision, on its own or as the handler is set up;
- a **cooldown** over time;
- a **failure** the member should see answered.

For a handler with none of these, [Invoke and dispatch](guide:invoke-and-dispatch) is all you need.

## Example

::example{file="testing/themes.spec.ts" region="override-theme"}

`overrideTheme` changes the app's primary colour for this module alone. The embed the handler sends has no colour of
its own, so `respond()` fills it from the theme, and the test reads the colour back from `getResponse`.

## How it works

A testing module runs each call in its theme as the bot does: MeoCord's defaults, the app's theme, each `@UseTheme`,
then what `themeFor` looks up for the call's server and user. Guards and cooldowns run in the same pipeline, in the
bot's order, and each module counts cooldowns in a store of its own.

The helpers here change one of those inputs for one test, and leave the rest as the bot has them.

## Themes

`overrideTheme(theme)` merges over the app's `@MeoCord({ theme })` for one module, as the example shows. It names
only the tokens it changes, and each `@UseTheme` still goes over it.

`overrideThemeFor(resolvers)` replaces the app's `themeFor`, or removes it with `undefined`. The results are cached
as the bot caches them, in the module's own [`ThemeCache`](api:utilities/ThemeCache), `module.themeCache`, so a mock
resolver shows each lookup:

::example{file="testing/themes.spec.ts" region="theme-for"}

`overrideThemeFor` takes a class implementing `ThemeResolver` too, in place of functions, and functions in place of
the app's class. The module binds the class as the app does, so `overrideProvider` replaces the class, or a service it
injects:

::example{file="testing/themes.spec.ts" region="theme-for-class"}

A service or presenter tested without a module runs in a theme with
[`withTheme(theme, fn)`](api:testing/withTheme). It takes a whole theme that
[`createMockTheme(overrides?)`](api:testing/createMockTheme) builds, frozen, with the overrides merged over the
defaults, or just the roles to change, which it merges the same way:

::example{file="testing/themes.spec.ts" region="mock-theme"}

When an app adds tokens of its own, `createMockTheme` requires them, as the app's root theme does, since they have no
default. Once `init({ ready: true })` has run, the module's app theme is also the one `useTheme()` reads outside any
call, until `close()`, unless another module or app in the same process was ready first, which keeps it: close each
module in `afterEach`. [Theming](guide:theming) covers the theme itself.

## Guards

A guard that reads the handler's metadata can be tested alone. Build it with an `ExecutionContext` for that handler,
from [`createExecutionContext(Controller, 'method', { args })`](api:testing/createExecutionContext):

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="unit"}

To check how a handler is set up, without running it, [`inspectHandler`](api:testing/inspectHandler) lists its
guards, interceptors, filters and cooldowns in the order dispatch applies them, with each guard's params, and reads
its metadata:

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="inspect"}

With `{ app }`, the app's global guards come first. Through `invoke`, a guard that returns `false` resolves with
`ran: false`, and one that throws `GuardDeniedError` rejects with it.

## Cooldowns

Each testing module counts in a fresh store, so the second call within the window is refused and a different user is
let in:

::example{file="controllers/slash/daily.slash.controller.spec.ts" region="spec"}

To see the window end, use fake timers and move time along:

::example{file="testing/cooldown-time.spec.ts" region="time"}

A cooldown store of your own is checked against the same behaviour MeoCord's stores meet, with
[`testCooldownStore`](api:testing/testCooldownStore); see [Cooldown stores](guide:recipes/cooldown-stores).

## Failure paths

What a member sees when something goes wrong deserves a test as much as the happy path:

- **An error no filter handles** rejects `invoke`, so `await expect(...).rejects.toThrow(...)` checks it. Through
  `dispatch`, the member gets the fallback's answer first, and `getResponse` shows it.
- **An error a filter handled** resolves, with `error` set, and `getResponse` shows the filter's answer.
- **A `UserError`** is the member's own outcome: `dispatch` answers it privately and resolves with it.
- **Discord's own errors** come from a mock that rejects with
  [`createDiscordError(code)`](api:testing/createDiscordError). Here the author has closed their DMs, and the review
  must be recorded anyway:

::example{file="tutorial/review.controller.spec.ts" region="closed-dms"}

## Gotchas

- **Fake timers left on break the next test.** Turn them on in `beforeEach` and off in `afterEach`, with
  `vi.useRealTimers()`, as the cooldown example does.
- **A module shared across tests shares its cooldown counts.** A second test sees the first test's calls. Build the
  module in the test, or in `beforeEach`.
- **`overrideThemeFor` replaces the app's resolvers.** To test the app's own `themeFor`, don't override it: give the
  mock interaction the `guildId` or user the resolver expects.

## Next steps

- [Theming](guide:theming): tokens, `@UseTheme` and `themeFor`, which these tests exercise.
- [Guards](guide:guards): writing the guards tested here.
- [Cooldowns](guide:cooldowns): windows, uses and scopes.
- [Mocks](guide:mocks#collectors): a collector's click, under test.
