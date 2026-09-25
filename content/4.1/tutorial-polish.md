---
id: tutorial-polish
title: Polish
section: Tutorial
order: 5.4
since: 4.1.0
---

The bot works. This page makes it pleasant: a limit on how often members send feedback, a look of its own,
a clear answer for a stale button, and a second language.

## A cooldown

Without a limit, one member can bury the staff channel. `@Cooldown({ uses: 1, seconds: 300 })` on the
`/feedback` handler, shown on [the first page](/docs/4.1/tutorial), allows one form every five minutes per
member. A call inside the window is refused privately: "Slow down: try again in 4m 12s."

The cooldown sits on the command, not on the submission, so a member is never refused after typing out a
whole form. The cost is that a form closed without sending still counts. [Cooldowns](/docs/4.1/cooldowns)
covers stacking, `per: 'guild'`, and exempting staff with `bypass`.

## A presenter

A [presenter](/docs/4.1/presenters) decides how the loading view `@Defer` shows, and every error view, look.
This one speaks the member's language, which the presenter receives as `locale`:

::example{file="tutorial/feedback.presenter.ts" region="presenter"}

`@MeoCord({ presenter: FeedbackPresenter })` in `app.ts` applies it to every handler.

## A stale button

Feedback lives in memory, so a restart forgets it, while the review post and its buttons stay in the
channel. A click on one of those buttons makes `FeedbackService.get` throw `FeedbackNotFoundError`. Without
a filter, the member would see the generic "Something went wrong". An
[exception filter](/docs/4.1/exception-filters) gives it a proper answer:

::example{file="tutorial/feedback-not-found.filter.ts" region="filter"}

`context.response` answers through the same `respond()` state the handler used. After `@Defer`, that means
a follow-up, shown only to the member and styled by the presenter. `@UseFilter(FeedbackNotFoundFilter)` on
`ReviewController` applies it to both buttons.

## A second language

Adding Indonesian takes one file. It holds any part of the default catalog, and whatever it leaves out
falls back to English:

::example{file="tutorial/locales/id.ts" region="catalog"}

Nothing else changes. The command's name and description are registered in both languages, and every
message, the presenter's included, follows the member's Discord language. The fallback keeps the bot
working while a translation is unfinished, and a test makes sure none ships that way:

::example{file="tutorial/i18n.spec.ts" region="spec"}

`expectCompleteCatalog` lists every message a language lacks, and every one the default catalog does not
have. Next: [testing it](/docs/4.1/tutorial-testing).
