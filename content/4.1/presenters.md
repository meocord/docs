---
id: presenters
title: Presenters
chapter: interactions
order: 8
summary: Decide how MeoCord's loading view and error answers look, in your bot's style and language.
learn:
  - Write a presenter for the loading and error views
  - Style an error by whether the user caused it
  - Draw a view as an image and attach it
  - Register it on the app and test it without a module
requires: [responses, defer]
api:
  [
    responses/ResponsePresenter,
    responses/ResponseContext,
    responses/PresentedError,
    responses/ResponseView,
    responses/ResponseFile,
    responses/MessageResponseContext,
  ]
since: 4.1.0
---

MeoCord answers for you in a few places: the loading view [`@Defer`](guide:defer) adds while a handler runs, the
error answer the built-in fallback sends when a call fails, a message command's error replies, and the reply of the
built-in `!help`. A presenter decides how those look, as text or as an image it draws. What they say is decided
elsewhere, by exception filters and the fallback.

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

`loading()` and `error()` each return a view, `{ text, title?, color?, emoji?, components?, files?, image?,
thumbnail? }`, or a promise of one. MeoCord renders it as an embed, or as a Components V2 container on a message that
uses Components V2. A view with no `color` takes the theme's primary colour.

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

## Drawing a view

A view can carry `files`, such as an image the presenter drew, and MeoCord attaches and shows them. This presenter
draws each error as a card with [meo-canvas](https://www.npmjs.com/package/meo-canvas), in the colour of its tone:

::example{file="presenters/card.renderer.ts" region="renderer"}

::example{file="presenters/card.presenter.ts" region="presenter"}

A file is an `AttachmentBuilder`, or `{ name, data }` with the bytes as a `Buffer` or `Uint8Array`. In an embed, the
first image is the embed's image. In a Components V2 container, images go in a gallery below the text, and other
files below it as file components. `image` and `thumbnail` name one of the files, or a URL: the embed's image and
thumbnail, or the container's leading image and the text's thumbnail. A file the view's own `components` show by
`attachment://<name>` isn't shown again.

Each method may draw asynchronously, and a slow drawing never misses Discord's three seconds:

- The loading view is drawn after `@Defer` acknowledges the call. Its files leave the message when the lock does.
- For an error on an interaction not yet acknowledged, MeoCord acknowledges it privately first, and the drawn view
  replaces the acknowledgement.
- A view added to a message by an edit keeps the message's own attachments.

A presenter that fails never leaves the user without an answer. When `error()` or `messageError()` throws, rejects, or
returns a view MeoCord can't render, such as a colour that is no colour or an empty text, MeoCord's own answer goes
out instead: its error view, or the plain text a message command gets without `messageError`. When MeoCord's fallback
is answering, the failure is then logged as the call's fault, and a testing module's `dispatch` rejects with it; a
`respond().error()` of your own logs it. A `loading()` that fails the same way is replaced by MeoCord's loading view,
with a warning naming the presenter, and the handler still runs.

Discord takes at most 10 attachments on a message, counting the ones a message the view is added to keeps, and each
file within the interaction's attachment size limit, or 20 MiB without one. A view past either is sent without its
files, and a warning says why. A send Discord refuses as too large, such as one with a file given as a path or a
stream, whose size can't be checked first, is sent again without its files. Either way, the image and thumbnail that
named a dropped file go with it, and the user still gets the answer.

## Message command errors

A message command can't be answered privately, so its errors are replies and direct messages: the usage reply, a
guard's or validation's reason, a `UserError`'s message, and the direct messages
[`dmOnError` and `dmOnCooldown`](guide:message-commands#telling-the-author-privately) send. They're plain text,
unless the presenter has a third, optional method, `messageError(context, error)`, which draws them as views. The
card presenter above has one, so a message command's errors get the same card.

Its [`MessageResponseContext`](api:responses/MessageResponseContext) has the `message` in place of an interaction:

| Field     | What it is                                                                 |
| --------- | -------------------------------------------------------------------------- |
| `message` | The message being answered.                                                |
| `locale`  | The server's preferred locale, or the translator's default locale in a DM. |
| `mode`    | Always `'embed'`: a reply is a new message, drawn as an embed.             |
| `theme`   | The call's resolved theme, as `ResponseContext` has it.                    |

The `error` it gets is a `PresentedError`, as `error()` gets. The view is sent as an embed with its files, under the
same limits. When it fails, the author gets the plain text instead, and the failure is the call's fault.

## The help reply

The built-in [`!help`](guide:message-commands) writes plain text. A presenter with another optional method,
`messageHelp(help, message)`, writes it instead: `help` is the [`MessageHelp`](api:types/MessageHelp) the built-in
found, a list of commands, one command, a parent's subcommands, or that nothing matched, and the method returns the
text or the options `message.reply` takes, such as an embed. [Message commands](guide:message-commands) shows one.
A help command of your own reads the same model from [`HandlerRegistry`](guide:handler-discovery).

## Testing a presenter

A presenter is plain code, so its test needs no module. Give it a context with a theme from
[`createMockTheme()`](api:testing/createMockTheme):

::example{file="presenters/brand.presenter.spec.ts"}

A drawn view's test checks the file it carries. The card presenter's draws a real PNG:

::example{file="presenters/card.presenter.spec.ts"}

## Gotchas

- **A presenter styles, it doesn't word.** The `message` it gets is what a filter or the fallback chose; change the
  words there, not here.
- **A file over Discord's limits is dropped, not the answer.** When a drawn image doesn't show, look for the
  warning, which names the file and the limit.
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
