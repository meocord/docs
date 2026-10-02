---
id: defer
title: '@Defer'
chapter: interactions
order: 7
summary: Answer within Discord's three seconds, and lock a component's message while its handler works.
learn:
  - Acknowledge before slow guards and handlers run
  - Lock a component's message and put it back afterwards
  - Choose when to acknowledge with mode, after and disable
requires: [responses, components]
api: [decorators/Defer]
since: 4.1.0
---

Discord gives a handler three seconds to answer. [`@Defer()`](api:decorators/Defer) answers for it, in two steps,
so a slow guard or handler never misses that window, and a stranger's click never touches someone else's message.

## When to use it

Put `@Defer()` on any interaction handler that might take more than a moment: one that calls a database or an API,
or sits behind a guard that does. On a button or a select menu, it also locks the message while the handler works,
so a user can't click twice.

Leave it off a handler that shows a modal, since a modal must be the first response, and off one that always
answers at once. For a handler that answers quickly most of the time, `mode: 'auto'` acknowledges only when it has
to.

## Example

::example{file="controllers/button/card.button.controller.ts" region="defer"}

The click is acknowledged before any guard runs. Once the call is allowed, the card's buttons are disabled, the
clicked one shows the loading emoji, and "Working on it…" is added. `send()` then puts the buttons back as they were
and replaces the loading view with the answer.

## How it works

1. **Before any guard runs,** `@Defer` acknowledges: a deferred reply for a command or a modal sent from one, shown as
   "thinking…", or an invisible deferred update for a button, a select menu or a modal from a message.
2. **Once guards, validation, pipes and cooldowns have allowed the call,** it locks a component's message: its
   controls are disabled, the clicked button shows the theme's loading emoji, and the
   [presenter's](guide:presenters) loading view is added.
3. **When the handler answers,** `send()` without `components` puts the message's controls back as they were before
   the lock, a button disabled on purpose included, and removes the loading view. `components: []` clears them.

A handler that returns without answering has its message put back too. When a component's handler throws, the error
is shown to the user privately, and the message is restored.

## Guards under @Defer

The lock waits for the guards, so a refused click never locks the message, not even briefly. Here, `OwnerGuard`
lets only the user whose id the button carries use it:

::example{file="guards/owner.guard.ts" region="guard"}

When someone else clicks, the guard throws `GuardDeniedError`, which is answered to them privately. A guard that
returns `false` leaves nothing behind: a command's deferred reply is deleted, and a component's message was never
touched.

::example{file="controllers/button/card.button.controller.spec.ts"}

## Options

| Option                  | Default   | What it does                                                                                         |
| ----------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `ephemeral`             | `false`   | Makes a command's deferred reply private.                                                            |
| `disable`               | `'all'`   | `'clicked'` disables only the control used, so the others stay usable. `'none'` skips the lock.      |
| `mode`                  | `'eager'` | `'auto'` acknowledges only if the handler hasn't answered after `after` milliseconds.                |
| `after`                 | `1500`    | For `'auto'`; never later than 2.5 seconds after the interaction was created.                        |
| `suppressNotifications` | `false`   | New messages, such as a first reply sent before `'auto'` acknowledged, and follow-ups, don't notify. |

Code that locks a message itself calls `respond(interaction).lock()`, which takes `disable` the same way; its options
type is [`ResponseLockOptions`](api:responses/ResponseLockOptions) from `meocord/common`.

### Acknowledging only when needed

Under `'auto'`, a handler that answers quickly answers with one reply or update, and nothing is locked:

::example{file="controllers/button/card.button.controller.ts" region="auto"}

A slow one is acknowledged at 1.5 seconds and then locked, as under `'eager'`.

### Locking only the clicked control

With `disable: 'clicked'`, two buttons of one message can run at once. Each is disabled while its own handler runs and
comes back when that handler finishes. The loading view stays until both have finished, unless one answers with
`send()`, whose answer replaces it.

::example{file="controllers/button/card.button.controller.ts" region="clicked"}

## The lock in a test

A test sees the lock as the calls `respond()` made. The message the button sits on is a `createMockMessage()` given
the controls it shows, as Discord's JSON:

::example{file="controllers/button/card.lock.spec.ts" region="message"}

::example{file="controllers/button/card.lock.spec.ts" region="lock"}

## Gotchas

- **Answer through `respond()`.** `interaction.reply()` fails once `@Defer` has acknowledged; `respond()` edits
  the deferred reply instead.
- **`@Defer` is for interaction handlers.** On a message, reaction, event or autocomplete handler, it's refused in
  one line, as the controller loads when it's written above the handler's decorator, and as the app is created when
  it's below: `Chat.hi: @Defer is for interaction handlers, and this is a message handler. Remove @Defer from it.`
- **A modal can't follow it.** A handler that shows a modal must leave `@Defer` off.

## Next steps

- [Answering with respond()](guide:responses): every call `send()` and its siblings can make.
- [Presenters](guide:presenters): change the loading view `@Defer` adds.
- [Guards](guide:guards): refuse a call before `@Defer` locks anything.
