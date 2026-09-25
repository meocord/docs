---
id: testing
title: Testing
section: Testing
order: 40
---

`meocord/testing` tests controllers, services and everything around them with no Discord connection. Its
mocks work with Vitest or Jest.

## Running tests

Generated apps come with Vitest set up: `vitest.config.ts` with SWC for the decorator metadata injection
needs, `vitest.setup.ts`, which resets MeoCord's mocks after every test, and a spec beside every generated
component:

```bash
npm test                # once
npm run test:watch      # on every change
npm run test:coverage   # with a coverage report
```

## The testing module

`MeoCordTestingModule` builds a container from the controllers and providers you give it, like the app does,
but only from those:

::example{file="controllers/slash/greeting.slash.controller.spec.ts"}

A dependency can be swapped for a stand-in, `overrideProvider(Class).useValue(stub)`, or listed as a provider
in any shape the app takes: `useValue`, `useClass` or `useFactory`, under a class or a token (see
[Providers](/docs/4.1/services#providers)). The classes the controllers and providers inject are bound as the
app binds them:

::example{file="testing/greeting.module.spec.ts" region="override"}

`module.get(Class)` returns an instance for a direct test, and `overrideGuard`, `overrideInterceptor` and
`overrideFilter` swap the stages around a handler the same way.

## What to test with what

- [`invoke`](/docs/4.1/invoke) runs a handler through everything dispatch runs around it, and `getResponse`
  reports what it sent to Discord. This is how most handler tests are written.
- `inspectHandler` lists what a handler is set up with, without running it.
- [Mocks](/docs/4.1/mocks) stand in for discord.js interactions, messages, users and the rest.
- `resolveRoute` answers which handler a component's `customId` or a message's content reaches, and
  `expectCompleteCatalog` checks a translator's catalogs.

## Which test for which question

| The question                              | The test                                                          |
| ----------------------------------------- | ----------------------------------------------------------------- |
| Is the logic right?                       | A plain unit test of the service, built with `new`                |
| What does the member see?                 | `invoke` the handler, then read `getResponse`                     |
| Does a flow work across controllers?      | One module with all of them, and one `invoke` per step            |
| Which handler does this `customId` reach? | `resolveRoute(App, { type, customId })`                           |
| Which handler does this message reach?    | `resolveRoute(App, { content })`                                  |
| Is the handler set up as intended?        | `inspectHandler`: its guards, interceptors, filters and cooldowns |
| Does an event handler react?              | `module.emit(event, ...args)`                                     |
| Is every message translated?              | `expectCompleteCatalog(t)`                                        |

Most of a bot's tests are the first two. A service that takes plain values needs no module at all, as
[Services](/docs/4.1/services#designing-a-service) shows, and the [tutorial](/docs/4.1/tutorial-testing)
has a flow test that follows feedback from the form to the author's DM.

## Failure paths

What a member sees when something goes wrong deserves a test as much as the happy path:

- **An error no filter handles** rejects `invoke`, so `await expect(...).rejects.toThrow(...)` checks it.
  The built-in fallback that would answer the member does not run in tests.
- **An error a filter handled** resolves, with `error` set, and `getResponse` shows the filter's answer.
- **A guard's refusal** rejects with `GuardDeniedError`, and nothing after the guard ran.
- **Discord's own errors** come from a mock that rejects with `createDiscordError(code)`. Here a member
  has closed their DMs, and the review must go through anyway:

::example{file="tutorial/review.controller.spec.ts" region="closed-dms"}

## Keeping tests apart

A testing module holds its own services and its own cooldown counts. Build one per test, or per `describe`
when the tests share nothing that changes, so state from one test never decides another. Mocks are reset
after every test by the generated `vitest.setup.ts`, which calls `resetAllMocks()`: set what a mock returns
in the test, or in `beforeEach`. See [Resetting between tests](/docs/4.1/mocks#resetting-between-tests).

For time, use Vitest's fake timers: `vi.useFakeTimers()`, then `vi.advanceTimersByTimeAsync(ms)`, as the
[scheduled task recipe](/docs/4.1/recipe-scheduled) does.

## What tests cannot tell you

The mocks behave like discord.js, but they are not Discord. These fail only against the real thing:

- **Discord's limits**: 2,000 characters in a message, 25 choices or options, 5 buttons in a row, 45
  characters in a modal title, and the rest of Discord's validation.
- **Permissions and role order**: a bot whose role sits below a member's cannot time them out, whatever the
  code says.
- **Intents**: an event the bot never receives because its intent is missing.
- **Startup**: a missing or invalid token, a config that does not load, a native addon built for another
  platform.

Before a release, start the bot against a test server with `npx meocord start --dev`, and use each changed
command once. Start it with a missing and with a wrong token, too, and check that it says so and exits.

## In CI

The checks a generated project runs locally are the ones to run in CI:

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test:coverage
      - run: npx meocord build --prod
```

Tests need no token and no network, so CI needs no secrets.
