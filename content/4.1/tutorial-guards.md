---
id: tutorial-guards
title: Only the staff
section: Tutorial
order: 5.3
since: 4.1.0
---

Anyone who can see the staff channel can press **Approve**. A [guard](/docs/4.1/guards) decides, before
the handler runs, whether the call goes ahead.

## The guard

::example{file="tutorial/staff.guard.ts" region="guard"}

`canActivate` returns `true` to let the call through. Throwing `GuardDeniedError` refuses it, and MeoCord
answers the member privately with the error's message, here in their language. Returning `false` stops the
call silently, which suits a button that should simply do nothing.

A guard is created for each call, and it injects services like any other class. `StaffGuard` asks for
`FeedbackSettings`, so the role comes from the same place as the channel.

`interaction.inCachedGuild()` narrows `interaction.member` to a full `GuildMember`, whose roles can be
checked. The builder already keeps `/feedback` out of DMs, but a guard makes no assumptions about where a
button is pressed.

## Applying it

`ReviewController` applies the guard to the whole class with `@UseGuard(StaffGuard)`, as shown on
[the previous page](/docs/4.1/tutorial-components). A guard can also sit on a single method, or apply to
every handler in the app through `@MeoCord({ guards })`.

`@Defer` acknowledges the click before the guard runs, and locks the post only once the guard allows the
call. A refused member sees the private refusal, and the post is left as it was.

## Testing it

The testing module runs guards exactly as the bot does. A member without the role is refused, and the
feedback is still open:

::example{file="tutorial/review.controller.spec.ts" region="spec"}

`providers` replaces `FeedbackSettings` with fixed values, so the test never reads the environment. Next:
[polish](/docs/4.1/tutorial-polish).
