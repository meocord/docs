---
id: defer
title: '@Defer'
section: Answering Discord
order: 21
since: 4.1.0
---

Discord gives a handler three seconds to answer. `@Defer()` answers for it, in two steps, so a slow guard or
handler never misses that window, and a stranger's click never touches someone else's message.

1. **Before any guard runs,** it acknowledges: a deferred reply for a command, shown as "thinking…", or an
   invisible deferred update for a button, a select menu or a modal from a message.
2. **Once guards, validation and pipes have allowed the call,** it locks a component's message: its
   controls are disabled, the clicked button shows the loading emoji, and the presenter's loading view is
   added ("⏳ Working on it…" by default).

::example{file="controllers/button/card.button.controller.ts" region="defer"}

`send()` without `components` puts the message's controls back as they were before the lock, a button
disabled on purpose included, and removes the loading view; `components: []` clears them. A handler that
returns without answering has its message put back too. When the handler throws, the error is shown to the
user privately, and the message restored.

## The lock in a test

A test sees the lock as the calls `respond()` made. `createMockMessage()` takes no components, so the
message the button sits on gets them assigned, built from Discord's JSON:

::example{file="controllers/button/card.lock.spec.ts" region="message"}

::example{file="controllers/button/card.lock.spec.ts" region="lock"}

## Guards under @Defer

The guard here, `OwnerGuard`, lets only the user whose id the button carries use it:

::example{file="guards/owner.guard.ts" region="guard"}

When someone else clicks, the guard throws `GuardDeniedError`, which is answered to them privately. The
message is never locked, not even briefly, since the lock waits for the guards. A guard that returns `false`
leaves nothing behind: a command's deferred reply is deleted, and a component's message was never touched.

::example{file="controllers/button/card.button.controller.spec.ts"}

## Options

| Option                  | Default   | What it does                                                                                                                                                    |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ephemeral`             | `false`   | Makes a command's deferred reply private.                                                                                                                       |
| `disable`               | `'all'`   | `'clicked'` disables only the control used, so the others stay usable; each click puts back its own control, whichever finishes first. `'none'` skips the lock. |
| `mode`                  | `'eager'` | `'auto'` acknowledges only if the handler has not answered after `after` milliseconds.                                                                          |
| `after`                 | `1500`    | For `'auto'`; never later than 2.5 seconds after the interaction was created.                                                                                   |
| `suppressNotifications` | `false`   | New messages, such as a first reply after `'auto'` waited, and follow-ups, do not notify.                                                                       |

Under `'auto'`, a handler that answers quickly answers with one reply or update, and nothing is locked:

::example{file="controllers/button/card.button.controller.ts" region="auto"}

A slow one is acknowledged at 1.5 seconds and then locked, as under `'eager'`.

With `disable: 'clicked'`, two buttons of one message can run at once: each is disabled while its own
handler runs and comes back when that handler finishes, and the loading view stays until both have.

::example{file="controllers/button/card.button.controller.ts" region="clicked"}

::example{file="controllers/button/card.lock.spec.ts" region="clicked"}

## Where it does not apply

Answer through `respond()`, not `interaction.reply()`, which fails once `@Defer` has acknowledged. `@Defer`
is for interaction handlers: on a message, reaction, event or autocomplete handler, it throws. A handler that
shows a modal cannot use it, since a modal must be the first response.
