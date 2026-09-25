---
id: testing
title: Testing
section: Testing
order: 40
---

`meocord/testing` tests controllers, services and everything around them with no Discord connection. Its
mocks work with Vitest or Jest.

## Running tests

Generated apps come with Vitest set up, `vitest.config.ts` with SWC for the decorator metadata injection
needs, and a spec beside every generated component:

```bash
npm test                # once
npm run test:watch      # on every change
npm run test:coverage   # with a coverage report
```

## The testing module

`MeoCordTestingModule` builds a container from the controllers and providers you give it, like the app does,
but only from those:

::example{file="controllers/slash/greeting.slash.controller.spec.ts"}

A dependency can be swapped for a stand-in, `overrideProvider(Class).useValue(stub)`, or listed as a provider,
`{ provide: Class, useValue }` or `{ provide: Class, useClass }`. The testing module binds only what it is
given, so a class a provider depends on is listed too:

::example{file="testing/greeting.module.spec.ts" region="override"}

`module.get(Class)` returns an instance for a direct test, and `overrideGuard`, `overrideInterceptor` and
`overrideFilter` swap the stages around a handler the same way.

## What to test with what

- [`invoke`](/docs/4.1/invoke) runs a handler through everything dispatch runs around it, and `getResponse`
  reports what it sent to Discord. This is how most handler tests are written.
- `inspectHandler` lists what a handler is set up with, without running it.
- [Mocks](/docs/4.1/mocks) stand in for discord.js interactions, messages, users and the rest.
- `resolveRoute` answers which handler a component's `customId` reaches, and `expectCompleteCatalog` checks
  a translator's catalogs.
