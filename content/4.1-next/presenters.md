---
id: presenters
title: Presenters
chapter: interactions
order: 8
summary: Decide how MeoCord's loading view and error answers look, in your bot's style and language.
learn:
  - Write a presenter for the loading and error views
  - Style an error by whether the user caused it
  - Register it on the app and test it without a module
requires: [responses, defer]
api: [responses/ResponsePresenter, responses/ResponseContext, responses/PresentedError, responses/ResponseView]
since: 4.1.0
---

MeoCord answers for you in three places: the loading view [`@Defer`](guide:defer) adds while a handler runs, the
error answer the built-in fallback sends when a call fails, and the reply of the built-in `!help`. A presenter decides
how those look. What they say is
decided elsewhere, by exception filters and the fallback.

## When to use it

Write a presenter when MeoCord's own answers should match yours: your bot's title for an error, a loading text in
the user's language, or an error that looks different when it's the user's mistake rather than the bot's.

To change only the colours or the loading emoji, you don't need one: set them in the [theme](guide:theming), and the
default presenter uses them. To change what an error says, write an
[exception filter](guide:exception-filters) instead.

## Example

::example{file="presenters/brand.presenter.ts" region="presenter"}

Register it on the app. It's resolved once, from the container, so it can inject services, a `Translator` to answer
in the user's language, for instance:

::example{file="app-with-presenter.ts" region="app"}

The loading view reads "Hang on…" with the theme's loading emoji. An error the user can fix, such as a refused or
invalid call, is titled "Not quite" in the warning colour, and a fault in the bot "Something went wrong" in the
danger colour.

## How it works

`loading()` and `error()` each return a view, `{ text, title?, color?, emoji?, components? }`. MeoCord renders it
as an embed, or as a Components V2 container on a message that uses Components V2. A view with no `color` takes the
theme's primary colour.

Each method gets a [`ResponseContext`](api:responses/ResponseContext):

| Field         | What it is                                                                              |
| ------------- | --------------------------------------------------------------------------------------- |
| `interaction` | The interaction being answered.                                                         |
| `locale`      | The user's locale, for text in their language.                                          |
| `mode`        | `'embed'` or `'v2'`, the form the view is rendered in.                                  |
| `theme`       | The call's resolved [theme](guide:theming), `@UseTheme` and per-server themes included. |

`error()` also gets a [`PresentedError`](api:responses/PresentedError): the `message` to show, the `error` itself, and
its `tone`. `tone` is `'warning'` for an answer that is no fault of the bot's code: the user's own doing, such as a
denied guard, a cooldown, invalid input or a `UserError`, and also a command nothing handles and a cooldown store
that is down. It's `'danger'` for anything else thrown. So `theme.colors[tone]` colours an error by kind.

Without a presenter, the loading view is "Working on it…" with the theme's loading emoji in its primary colour, and
errors are titled "Oops!" in the colour of their tone, both in the user's language where the app
[translates MeoCord's texts](guide:localisation).

## The help reply

The built-in [`!help`](guide:message-commands) writes plain text. A presenter with a third, optional method,
`messageHelp(help, message)`, writes it instead: `help` is the [`MessageHelp`](api:types/MessageHelp) the built-in
found, a list of commands, one command, a parent's subcommands, or that nothing matched, and the method returns the
text or the options `message.reply` takes, such as an embed. [Message commands](guide:message-commands) shows one.
A help command of your own reads the same model from [`HandlerRegistry`](guide:handler-discovery).

## Testing a presenter

A presenter is plain code, so its test needs no module. Give it a context with a theme from
[`createMockTheme()`](api:testing/createMockTheme):

::example{file="presenters/brand.presenter.spec.ts"}

## Gotchas

- **A presenter styles, it doesn't word.** The `message` it gets is what a filter or the fallback chose; change the
  words there, not here.
- **A context built by hand needs `theme`,** and a `PresentedError` needs `tone`. Use `createMockTheme()` for the
  theme in a test.

## Build it

The feedback bot's loading view and its error answers use MeoCord's defaults. Give them the bot's own words, coloured by
the theme:

::example{file="tutorial/feedback.presenter.ts" region="presenter"}

Register it on the app:

::example{file="tutorial/app.ts" region="step:presenters"}

Click Approve on a report: while the review is saved, the post shows the bot's loading text, with the theme's
loading emoji, in the theme's primary colour.

## Next steps

- [Theming](guide:theming): set the colours and emojis a presenter reads from `theme`.
- [Exception filters](guide:exception-filters): change what an error says, and throw a `UserError` for the user's
  own mistakes.
- [Localisation](guide:localisation): answer in the user's language, in a presenter and everywhere else.
