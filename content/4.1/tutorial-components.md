---
id: tutorial-components
title: The form and the buttons
section: Tutorial
order: 5.2
since: 4.1.0
---

The form from [the previous page](/docs/4.1/tutorial) has the custom ID `feedback/submit`. This page
handles its submission, posts the feedback to the staff channel, and handles the **Approve** and **Reject**
buttons on that post.

## Where feedback goes

The staff channel and the staff role differ from server to server, so they come from the environment. A
small service reads them once:

::example{file="tutorial/feedback.settings.ts" region="settings"}

Because it is a service, tests replace it with their own values, and nothing reads `process.env` in the
middle of a handler.

## The submission

A handler for `CommandType.MODAL_SUBMIT` receives the form's fields as its second argument, named by their
custom IDs:

::example{file="tutorial/feedback.controller.ts" region="submit"}

A few details are worth a look:

- **Two languages at once.** `t.for(interaction, { public: true })` uses the server's language, since the
  whole staff reads the post. The thanks uses `t.for(interaction)`, the author's own.
- **The buttons carry the id.** Their custom IDs are `feedback/1/approve` and `feedback/1/reject`. The
  review handlers declare `feedback/{id}/approve`, and MeoCord captures `id` for them. See
  [Component routing](/docs/4.1/component-routing).
- **The thanks is private.** `flags: MessageFlags.Ephemeral` shows it to the author alone.
- **A misconfigured channel fails loudly.** The error reaches the built-in fallback, which logs it and tells
  the member something went wrong.

## The review buttons

The buttons live in a controller of their own:

::example{file="tutorial/review.controller.ts" region="controller"}

`@Defer()` acknowledges the click at once. Once the call is allowed, it disables the post's buttons and shows
a loading view while the handler works. The handler then replaces the post in one edit: the same embed with a footer naming the
reviewer, and no buttons, so feedback is decided once. [Deferring](/docs/4.1/defer) covers the rest of its
options.

The DM uses the locale stored with the feedback, since the author is not the one clicking. Members can
close their DMs, and `.catch(() => undefined)` keeps that from failing the review.

`@UseGuard(StaffGuard)` and `@UseFilter(FeedbackNotFoundFilter)` sit on the class, so they apply to both
buttons. As written, anyone who can see the post could press them. Next:
[only the staff](/docs/4.1/tutorial-guards).
