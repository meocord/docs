---
id: tutorial-testing
title: Testing it
section: Tutorial
order: 5.5
since: 4.1.0
---

Each part already has a test beside it. This page adds one that runs the whole flow, from the form to the
author's DM, through the same pipeline the bot uses. It needs no Discord connection.

## The controller on its own

`MeoCordTestingModule` builds the controllers with their services, guards and filters. `invoke` runs a
handler as dispatch would, and `getResponse` reports what `respond()` did:

::example{file="tutorial/feedback.controller.spec.ts" region="spec"}

Each call to `compile()` returns a fresh module, with fresh services and fresh cooldown counts, so tests do
not leak into one another. The mocks come from `meocord/testing`:

- `createMockClient()` has its managers ready: `users.send()` resolves to a mock message with no setup, and
  a test stubs `channels.fetch()` to hand back the channel it wants to inspect.
- `createMockChannel(TextChannel)` records what is sent to it.
- `createModalFields()` fills a form the way Discord delivers one.

## The whole flow

One module, with both controllers and the app, so the presenter applies too. Ada submits in Indonesian,
Grace approves, and the test checks what each of them sees:

::example{file="tutorial/feedback.flow.spec.ts" region="spec"}

The flow test uses real behaviour at each step:

- The review post Grace clicks is built from what the bot actually sent, not from a hand-written copy.
- `resolveRoute(App, ...)` confirms that the button's custom ID reaches `approve`, across every controller
  the app registers, with the id captured.
- `app: App` applies the app's presenter, so the loading view is the real one, in Grace's language.

Run the suite with `npm test`. [Testing](/docs/4.1/testing) and [Mocks](/docs/4.1/mocks) cover the rest of
the toolkit. Next: [shipping it](/docs/4.1/tutorial-shipping).
