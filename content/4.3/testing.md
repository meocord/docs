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
api:
  [
    testing/MeoCordTestingModule,
    testing/TestingModuleBuilder,
    testing/TestingModule,
    testing/TestingModuleOptions,
    testing/FromAppOptions,
    testing/TestingModuleInitOptions,
    testing/resetAllMocks,
    testing/useMockFn,
  ]
since: 4.0.0
formerly: [tutorial-testing]
---

`meocord/testing` runs your controllers, services, guards and everything around them inside a test, with no
Discord connection and no token. `MeoCordTestingModule` builds a container from the classes you list, as the bot
builds one from `@MeoCord`, and the module it compiles runs handlers through the same pipeline the bot uses, but for
`emit`, which runs the bot's event fallback only with
[`eventFallback: true`](guide:invoke-and-dispatch#events-and-handler-setup).

The mocks it comes with behave like discord.js, and work under Vitest, Jest, Node's test runner and bun test:

- **Vitest** runs a generated app's tests as they come.
- **Jest** runs as `jest`, with no Node flags: meocord's CommonJS build bundles the packages that ship only as ES
  modules.
- **Node's test runner** asserts through a mock's `.mock.calls`.
- **bun test** takes `useMockFn(mock)`, with `mock` from `bun:test`, in a preloaded file, so Bun's matchers, such as
  `toHaveBeenCalledWith`, read MeoCord's mocks; without it, assert through `.mock.calls`. See
  [Your test runner's mocks](guide:mocks#your-test-runners-mocks).

Whatever the runner, the tests need decorator metadata compiled in, which MeoCord reads to inject a class's
dependencies. Under Jest and Node's test runner, compile them with SWC or `tsc` with decorator metadata, as a generated
app's Vitest config does with SWC; `node --test` on `.ts` files strips the types without transforming decorators, so a
decorated class fails to load. bun test reads `emitDecoratorMetadata` from tsconfig.json.

A test process can load both of meocord's builds, such as jest setup files written in CommonJS beside specs written as
ES modules. A class the app injects, such as `Translator`, `ThemeCache` or `ExecutionContext`, is then one class for
both, so a constructor typed with either build's class gets the app's instance, and `instanceof` agrees. Other
classes, such as `Logger` and `MeoCordTestingModule`, stay one per build: import each from the same build throughout.

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
  never starts a service it didn't ask for. To build the whole app instead, see
  [Testing the whole app](#testing-the-whole-app).
- **Each `compile()` is a new module**, with its own services and theme cache, and its own cooldown counts unless its
  store keeps them outside the process or a `useValue` store is shared; see
  [Testing recipes](guide:testing-recipes#how-it-works). It sets its presenter, theme and translator on the client of
  each call it runs, an `emit()`'s under strict mocks only, so give each test its own client: in default mode a module
  without a presenter, dispatching on a client another module used, answers with that module's presenter, with a
  warning once.
- **`compile()` runs the bot's startup checks** on what it builds, such as two handlers for one command, or two
  handlers with the same customId pattern, and throws the first it finds. A handler declared with a `CommandType` and no
  builder is accepted, so a test fixture needs no builder.
- **Handlers run through the pipeline**: `@Defer`, guards, interceptors, validation, pipes, cooldowns and exception
  filters, in the bot's order. [Invoke and dispatch](guide:invoke-and-dispatch) covers the two ways to run one.

Pass the app class as `app` to add what `@MeoCord` declares: its global guards, interceptors and filters, its
presenter, translator, message options, observers and theme, and its cooldown store and policy. The controllers are
still the ones you list. A store that injects something, such as a database pool, needs it in `providers`, or a
`CooldownStore` provider of your own, such as a `MemoryCooldownStore`, in the store's place.

::example{file="testing/greeting.module.spec.ts" region="app"}

### Options the app sets

A module built with `app`, or with `fromApp`, follows three of the app's `@MeoCord` options as the bot does, one with
another default:

- **`answerDenied: true`.** A guard's `false` on an interaction counts as a thrown `GuardDeniedError`: `invoke` rejects
  with it and sends nothing, and `dispatch` answers it as the bot does, privately. Without the option, `invoke` resolves
  with `ran: false`. See [Guards](guide:guards).
- **`waitForReady: true`.** A `dispatch`, `invoke` or `emit` made while `init({ ready: true })` runs the `onReady` hooks
  waits for the hooks of the classes it uses, as the bot's calls do. A call made once they have settled, or without
  `ready`, runs at once. One still waiting when `close()` comes is dropped as the bot drops it at a stop, and a
  deferred reply its `@Defer` already sent is deleted, so [`getResponse`](api:testing/getResponse)`(interaction).calls`
  ends with `deleteReply`. See [Lifecycle hooks](guide:lifecycle-hooks#waiting-for-the-hooks).
- **`warnSlow`.** The module warns about slow work only when the app sets `warnSlow: true`, where the bot warns unless
  it is `false`: a test's fake clock can pass those times inside a handler.

## Swapping a dependency

`overrideProvider(Class).useValue(stub)` replaces a dependency with a stand-in that has only the members the test
uses. A misspelled member written in the call is a compile error, so the stand-in can't drift from the class; write
the stub inline, or type it `Partial<Class>`, to keep that check:

::example{file="testing/greeting.module.spec.ts" region="override"}

A provider can also be listed in any shape the app takes, `useValue`, `useClass` or `useFactory`, under a class or a
token; see [Providers](guide:services#providers). `overrideGuard`, `overrideInterceptor` and `overrideFilter` swap the
stages around a handler the same way, wherever they apply: globally, on the controller or on the method. An override
stands in for the stage wherever it is bound, a guard listed in `providers` included, and wins over an
`overrideProvider` of it. Its stub needs the stage's method, `canActivate`, `intercept` or `catch`: under strict mocks
`compile()` refuses one without it, and otherwise warns.

`module.get(Class)` returns an instance, for a direct test of a service as the container built it. A class that
depends on a factory returning a promise needs `await module.init()` first, or `get` throws, saying so. `invoke`,
`dispatch` and `emit` run `init()` themselves.

## Testing the whole app

[`MeoCordTestingModule.fromApp(App)`](api:testing/MeoCordTestingModule) builds the module as the bot builds itself:
every controller, service and provider `@MeoCord` lists, with what the `app` option takes from it: its global
guards, interceptors and filters, presenter, translator, message options, theme, observers and cooldown store.
A test lists nothing again, and replaces what it must by token in `providers`, before anything is made:

::example{file="recipes/database/app.spec.ts" region="spec"}

`compile()` runs no factory. `init()` runs each one the test didn't replace and makes the app's `services`, as the
bot does before it logs in; the database factory replaced here never runs, so nothing connects. `fromApp`'s
`controllers` and `observers` options add a test's own, and the `override*` methods still apply.

The module makes no Discord `Client`: a class that injects one, a guard, interceptor or filter included, is refused
where it is resolved, naming each class of the module that injects it, until the test provides one, such as `{ provide:
Client, useValue: createMockClient() }`.

## Sharing setup across specs

Share setup with functions: one that builds and returns a compiled module, and others that take a module and run a
step tests repeat. Subclassing `TestingModule` isn't supported; a module only comes from `compile()`.

::example{file="testing/card.helpers.ts" region="helpers"}

Each spec builds its own module from them, and reads like the steps a member takes:

::example{file="testing/card.helpers.spec.ts" region="spec"}

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
- **The cooldown store.** The app's store, or the `CooldownStore` a test provides in its place, gets its `onReady`
  first and its `onShutdown` last, once the store operations its calls started have settled.
- **A shutdown that hangs.** `close()` waits for the whole sequence for up to `shutdownTimeout`, 10 seconds unless
  `create()` or `fromApp()` sets it, as the bot's [`shutdownTimeout`](guide:configuration) does. It then stops waiting
  and logs that it did, and still rejects with a hook that failed before then. A test whose fake store never answers, or
  whose `onShutdown` never settles, sets it short, such as `shutdownTimeout: 50`.
- **A `close()` during the `onReady` hooks.** Once `init({ ready: true })` is asked, `close()` lets no further
  `onReady` start, as a bot that stops while it comes online, and waits for the one under way within the module's
  `shutdownTimeout`. It runs no `onShutdown` for a class whose `onReady` hasn't settled by then, the one it stopped
  waiting for or one that never started, nor for anything that depends on it; one whose `onReady` threw has settled and
  is shut down. A test that expects every hook to run awaits `init({ ready: true })` before `close()`. Without `ready`,
  `close()` shuts down everything the module made.
- **A `close()` during `init()`.** It waits for the factory under way at most `shutdownTimeout`, then warns, naming the
  factory, and shuts down without it. `init()` makes nothing after that factory, no other factory, no listed service
  and no `onReady` hook, and still resolves. A value the factory returns later is shut down once it arrives and
  `close()` is done with the rest. A `get()` of a factory value `init()` skipped throws, saying `close()` ended `init()`
  before it made that value. A `dispatch`, `invoke` or `emit` made while that `init()` ran never starts, as a call the
  bot drops at a stop: no handler runs, and it resolves with `ran: false`, or `ran: 0` for `emit`, and the error "The
  bot stopped before this call started.".
- **A call that closes the module.** A `close()` called from a call the module is running, such as a handler that
  awaits `module.close()`, doesn't wait for that call, as the bot's `app.stop()` doesn't; it still waits for the other
  calls under way.
- **A hook that closes the module.** A `close()` called while an `onShutdown` hook of that close runs, by the hook or
  by work it started, awaited or not, resolves for it at once, and the hooks after it run in order. One called after
  the hook has returned waits for the whole close.
- **The theme outside calls.** Once ready, the module's app theme is the one `useTheme()` reads outside any call,
  until `close()`, unless another module or app in the same process was ready first, which keeps it. See
  [Testing recipes](guide:testing-recipes#themes).
- **After `close()`.** A closed module still runs what `dispatch`, `invoke` and `emit` are given, against services
  already shut down, and warns once that it is closed, answering in the handler's theme without asking the app's
  `themeFor` resolver, which its `onShutdown` may have closed. Close it after the test's last call, in `afterEach`. A
  `get()` returns what `close()` shut down without a word; one that makes an instance with an `onShutdown` only then,
  such as a listed service an `init()` that `close()` ended didn't make, warns once, naming it, since nothing shuts it
  down.

## Running tests

A generated app has Vitest set up: `vitest.config.ts` compiles with SWC, which gives the decorator metadata
injection needs, and every generated component has a spec beside it. A generated controller's spec invokes its handler
through the testing module and checks the answer, so it fails when the handler stops answering.

```bash
npm test                # once
npm run test:watch      # on every change
npm run test:coverage   # with a coverage report
```

`vitest.setup.ts` runs before every spec file. It has MeoCord's mocks made with `vi.fn`, so Vitest treats them as its
own, and [strict](guide:mocks#strict-mocks), so they compute what discord.js computes, and resets them after every test:

::example{file="config/vitest.setup.ts" region="setup"}

Tests don't load `.env`, so a real token never reaches a spec unless you ask for it, and tests run the same before
and after a build. A project whose tests need its variables loads the files `meocord.config.ts` reads under test, in
`vitest.setup.ts`: `config({ path: ['.env.test.local', '.env.test', '.env'], quiet: true })`, with `config` from
`dotenv`.

## What tests can't tell you

The mocks behave like discord.js, but they aren't Discord. These fail only against the real thing:

- **Discord's limits**: 2,000 characters in a message, 5 buttons in a row, and the rest of what Discord checks and
  discord.js doesn't. A test catches only what discord.js refuses itself, such as a builder's `setTitle` over 45
  characters or, under strict mocks, a button with no label, and an autocomplete's 25 choices, which the mock refuses.
- **Permissions and role order**: a bot whose role sits below a member's can't time them out, whatever the code
  says.
- **Intents**: an event the bot never receives because its intent is missing.
- **Startup**: a missing or invalid token, a config that doesn't load, a native addon built for another platform.

Before a release, start the bot against a test server with `npx meocord start --dev`, and use each changed command
once. Start it with a missing and a wrong token too, and check that it says so and exits.

## In CI

The checks a generated project runs locally are the ones to run in CI. Tests need no token and no network, so CI
needs no secrets. `npm run lint` fixes what it can, so CI runs ESLint without `--fix`, where a problem fails the job:

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
      - run: npx eslint
      - run: npx tsc --noEmit && npx tsc --noEmit -p tsconfig.test.json
      - run: npm run test:coverage
      - run: npx meocord build --prod
```

## Gotchas

- **State set once for a whole `describe` is gone after the first test.** `vitest.setup.ts` resets every MeoCord mock
  after each test, through `resetAllMocks()`; a `vi.fn()` of your own only has its calls cleared. Set what a mock
  returns in the test that relies on it, or in `beforeEach`.
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
- [Testing recipes](guide:testing-recipes): themes, guards, cooldowns and failure paths under test.
- [Services](guide:services): designing services a test can build with `new`.
