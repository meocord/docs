---
id: testing
title: The testing module
chapter: testing
order: 1
summary: Build your controllers and services in a test, with no Discord connection, and run them as the bot does.
learn:
  - Build a testing module from the classes a test needs
  - Swap a dependency, a guard or an interceptor for a stand-in
  - Run lifecycle hooks and keep tests apart
requires: [services]
api: [testing/MeoCordTestingModule, testing/TestingModuleBuilder, testing/TestingModule, testing/resetAllMocks]
since: 4.0.0
---

`meocord/testing` runs your controllers, services, guards and everything around them inside a test, with no
Discord connection and no token. `MeoCordTestingModule` builds a container from the classes you list, as the bot
builds one from `@MeoCord`, and the module it compiles runs handlers through the same pipeline the bot uses.

The mocks it comes with behave like discord.js, and work with Vitest or Jest.

## When to use it

Use a testing module whenever the code under test is a controller, or anything MeoCord resolves for you: a service
with injected dependencies, a guard, an interceptor, a presenter. It is how you check what a member sees.

A service that takes plain values needs no module: build it with `new` and test it as a class, as
[Testing a service](guide:services#testing-a-service) shows. To check which handler a `customId` or a message reaches
without running it, use [`resolveRoute`](api:testing/resolveRoute) instead.

## Example

::example{file="controllers/slash/greeting.slash.controller.spec.ts" region="spec"}

The module is built from one controller and whatever it injects. `invoke` runs the `greet` handler with a mock
interaction whose options say `Ada`, and [`getResponse`](api:testing/getResponse) reports what the handler sent.

## How it works

[`MeoCordTestingModule.create`](api:testing/MeoCordTestingModule) takes the controllers, providers and observers a
test needs, and returns a builder. `compile()` binds them into a fresh container and returns the module:

- **Only what you list is built**, plus what those classes inject. Nothing else from the app is loaded, so a test
  never starts a service it didn't ask for.
- **Each `compile()` is a new module**, with its own services, its own cooldown counts and its own theme cache.
- **Handlers run through the pipeline**: `@Defer`, guards, interceptors, validation, pipes, cooldowns and exception
  filters, in the bot's order. [Invoke and dispatch](guide:invoke-and-dispatch) covers the two ways to run one.

Pass the app class as `app` to add what `@MeoCord` declares: its global guards, interceptors and filters, its
presenter, translator, message prefixes, observers and theme. The controllers are still the ones you list.

::example{file="testing/greeting.module.spec.ts" region="app"}

## Swapping a dependency

`overrideProvider(Class).useValue(stub)` replaces a dependency with a stand-in that has only the members the test
uses. A misspelled member is a compile error, so the stand-in can't drift from the class:

::example{file="testing/greeting.module.spec.ts" region="override"}

A provider can also be listed in any shape the app takes, `useValue`, `useClass` or `useFactory`, under a class or a
token; see [Providers](guide:services#providers). `overrideGuard`, `overrideInterceptor` and `overrideFilter` swap
the stages around a handler the same way, wherever they apply: globally, on the controller or on the method.

`module.get(Class)` returns an instance, for a direct test of a service as the container built it.

## Lifecycle hooks in a test

`init()` resolves the module's factory providers, including the ones that return a promise, and runs no hook.
`init({ ready: true })` also runs every `onReady` hook once, as the bot does when it comes online. `close()` runs the
`onShutdown` hooks of everything the module built:

::example{file="testing/lifecycle.spec.ts" region="lifecycle"}

- **Order.** The hooks run as the bot runs them: `onReady` one at a time, each class after the classes it injects;
  `onShutdown` in reverse, so a pool closes after everything that uses it.
- **The client.** `onReady` receives a mock client and `{ primary: true }`, unless you pass
  `init({ ready: { client, primary } })`.
- **Failures.** Every hook runs even when one throws, and `init` or `close` then rejects with that error, or with an
  `AggregateError` naming each hook that threw.
- **The theme outside calls.** Once ready, the module's app theme is the one `useTheme()` reads outside any call,
  until `close()`, unless another module or app in the same process was ready first, which keeps it. See
  [Testing recipes](guide:testing-recipes#themes).

## Running tests

A generated app has Vitest set up: `vitest.config.ts` compiles with SWC, which gives the decorator metadata
injection needs, and every generated component has a spec beside it.

```bash
npm test                # once
npm run test:watch      # on every change
npm run test:coverage   # with a coverage report
```

`vitest.setup.ts` runs before every spec file. It resets MeoCord's mocks after every test:

::example{file="config/vitest.setup.ts" region="setup"}

Tests don't load `.env`, so a real token never reaches a spec unless you ask for it, and tests run the same before
and after a build. A project whose tests need its variables adds `import 'dotenv/config'` to `vitest.setup.ts`.

## What tests can't tell you

The mocks behave like discord.js, but they aren't Discord. These fail only against the real thing:

- **Discord's limits**: 2,000 characters in a message, 25 choices, 5 buttons in a row, 45 characters in a modal
  title, and the rest of Discord's validation.
- **Permissions and role order**: a bot whose role sits below a member's can't time them out, whatever the code
  says.
- **Intents**: an event the bot never receives because its intent is missing.
- **Startup**: a missing or invalid token, a config that doesn't load, a native addon built for another platform.

Before a release, start the bot against a test server with `npx meocord start --dev`, and use each changed command
once. Start it with a missing and a wrong token too, and check that it says so and exits.

## In CI

The checks a generated project runs locally are the ones to run in CI. Tests need no token and no network, so CI
needs no secrets:

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

## Gotchas

- **State set once for a whole `describe` is gone after the first test.** `vitest.setup.ts` resets every MeoCord mock
  after each test, through `resetAllMocks()`; a `vi.fn()` only has its calls cleared. Set what a mock returns in the
  test that relies on it, or in `beforeEach`.
- **A module shared across tests shares its state.** Cooldown counts and service fields carry over. Build one module
  per test, or per `describe` when the tests change nothing in it.
- **Calling a controller method directly skips the pipeline.** `module.get(Controller).method(interaction)` runs its
  own guards, but no interceptors, validation or filters. Use `invoke` to test what dispatch runs around a handler.

## Build it

The feedback bot opens a form with `/feedback` and posts what members send for staff to review. Give its controller a
spec. The settings the bot reads from the environment become test values, and each test runs a handler as dispatch
would:

::example{file="tutorial/feedback.controller.spec.ts" region="spec"}

Run `npm test`. The form opens in Ada's language and refuses a second try within five minutes, and their submission
reaches the review channel with its buttons.

## Next steps

- [Invoke and dispatch](guide:invoke-and-dispatch): the two ways to run a handler, and which to use when.
- [Mocks](guide:mocks): the interactions, messages, users and errors a test passes in.
- [Testing recipes](guide:testing-recipes): themes, guards, cooldowns and collectors under test.
- [Services](guide:services): designing services a test can build with `new`.
