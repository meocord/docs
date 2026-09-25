---
id: tutorial
title: 'Tutorial: a feedback bot'
section: Tutorial
order: 5.1
since: 4.1.0
---

This tutorial builds a complete bot, a step at a time, on top of [A first command](/docs/4.1/quick-start).
Members send feedback with `/feedback`. It opens a form, and the bot posts what they write to a staff
channel with **Approve** and **Reject** buttons. When someone on the staff presses one, the post shows the
verdict and the author gets a DM about it, in their own language.

Each page adds one part:

1. **This page:** the command and the service that stores feedback.
2. [The form and the buttons](/docs/4.1/tutorial-components): a modal, its submission, and review buttons
   that carry the feedback's id.
3. [Only the staff](/docs/4.1/tutorial-guards): a guard that reads its role from settings.
4. [Polish](/docs/4.1/tutorial-polish): a cooldown, a presenter, an exception filter, and a second
   language.
5. [Testing it](/docs/4.1/tutorial-testing): one test that runs the whole flow.
6. [Shipping it](/docs/4.1/tutorial-shipping): configuration, a production build, and running it.

## Before you start

You need a project from `npx meocord create`, as in [Getting started](/docs/4.1/getting-started), and a
Discord server where you can create a channel and a role. The examples keep every file in one folder,
`src/tutorial`. In your bot, the layout from [Project structure](/docs/4.1/project-structure) works just as
well.

## The text, in one place

Everything the bot says lives in a catalog, even while it speaks only English. Adding a language later is
then a matter of adding a file:

::example{file="tutorial/locales/en-US.ts" region="catalog"}

`defineCatalog` keeps each message's exact type, so a misspelled key or a missing `{placeholder}` fails the
typecheck. The translator is created once, at module scope:

::example{file="tutorial/i18n.ts" region="translator"}

The Indonesian file it imports comes on the [Polish](/docs/4.1/tutorial-polish) page, and
[Localisation](/docs/4.1/localisation) covers the translator in full.

## The command

The builder describes `/feedback` to Discord, with its name and description in every language the catalog
has. `setContexts(InteractionContextType.Guild)` keeps it out of DMs, because feedback goes to a server's
staff:

::example{file="tutorial/feedback.builder.ts" region="builder"}

## The service

Feedback needs a home. A service is a plain class marked `@Service()`. MeoCord creates one instance and
hands it to every class that asks for it:

::example{file="tutorial/feedback.service.ts" region="service"}

It stores the author's locale so the verdict can reach them in their language later. `get` throws a
dedicated error for an id it does not hold, and the [Polish](/docs/4.1/tutorial-polish) page gives that
error its own answer:

::example{file="tutorial/feedback.errors.ts" region="error"}

A service needs no Discord to test:

::example{file="tutorial/feedback.service.spec.ts" region="spec"}

This version keeps feedback in memory, so a restart forgets it. [A database](/docs/4.1/recipe-database)
shows the lasting version, and nothing else in the tutorial changes when you switch.

## The controller

`/feedback` answers with a form. `respond(interaction).modal()` shows it, and the modal's custom ID,
`feedback/submit`, decides which handler receives what the member types:

::example{file="tutorial/feedback.controller.ts" region="open"}

`t.for(interaction)` picks the member's language. The `@Cooldown` line is explained on the
[Polish](/docs/4.1/tutorial-polish) page.

The controller asks for `FeedbackService` in its constructor, which is all it takes to bind the service:

::example{file="tutorial/app.ts" region="app"}

The app already lists `ReviewController` and `FeedbackPresenter`, which the next pages write. Next:
[the form and the buttons](/docs/4.1/tutorial-components).
