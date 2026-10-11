---
id: responses
title: Answering with respond()
chapter: interactions
order: 6
summary: Answer an interaction with one call that picks the right Discord method for where the answer stands.
learn:
  - Send, edit and follow up without choosing Discord's call yourself
  - Buy time with acknowledge() and show a modal
  - Make a message private, and keep it private
requires: [slash-commands, components]
api: [responses/respond, responses/ResponseState, responses/ResponseSendOptions]
since: 4.1.0
covers: [4.1/interaction-responses]
---

Discord has a different call for each state an interaction's answer can be in: `reply` for a first answer,
`deferReply` and `deferUpdate` to buy time, `editReply` once deferred, `update` for a component's message, and
`followUp` for another message. Pick the wrong one and Discord rejects it.
[`respond(interaction)`](api:responses/respond) keeps track of where the answer stands and makes the right call, so a
handler says what to send, not how.

## When to use it

Use `respond()` for every answer a handler sends. It works for commands, components and modals alike, and it's what
MeoCord's own views, [`@Defer`](guide:defer) and the error fallback use, so your answers and MeoCord's never
collide.

You can still call `interaction.reply()` directly. `respond()` reads the interaction's state on every call, so it
notices, but an answer sent around it doesn't get the [theme's colour](guide:theming#what-respond-themes).

## Example

::playground{file="controllers/slash/profile.slash.controller.ts" region="respond" dispatch="/profile"}

The handler acknowledges first, so the user sees "thinking…" while the profile loads. `send()` then edits that
deferred reply, since the interaction is no longer unanswered, and `followUp()` adds a private tip.

A test sees the calls it made:

::example{file="controllers/slash/profile.slash.controller.spec.ts"}

A call Discord refused stays in `calls`, in the order it was made, with the error it rejected with as `error`, and
doesn't count towards `sent`. The mock doesn't keep Discord's clock: to test a slow handler, make the first answer
reject with `createDiscordError(10062)`. `getResponse()` then reports `sent: false`, as the user would see it.

## How it works

`respond(interaction)` returns the same object for the whole life of one interaction, so a helper, a guard and the
handler all see one answer. Interceptors and exception filters reach it as `context.response`.

Before each call, it reads where the answer stands from the interaction itself, as `state`: `'unanswered'`,
`'deferred'` or `'replied'`. Answers made directly through discord.js, or by a collector, count too.

Besides `state`, it has `message`, the answer's message (or the message a component is on); `original`, the
components and embeds of a message before `@Defer` locked it; and `location`, the same report as
[`getInstallContext()`](guide:install-contexts).

Answers asked for together go out one after another, in the order they were made, each from where the last left the
interaction. Two `send()` calls at once reply and then edit, rather than both replying, and so do a `send()` in flight
and the error the fallback answers with. When Discord refuses an answer, the state stays right:

- An acknowledgement that fails leaves the interaction unanswered, so the next `send()` replies rather than throwing
  that failure again.
- A reply or an update refused with 40060, because the interaction was answered elsewhere, still throws, and the next
  `send()` edits that answer.

## The calls

| Call                                      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acknowledge({ ephemeral })`              | Buys time: a deferred reply for a command or a modal sent from one, shown as "thinking…", or an invisible deferred update for a component or a modal from a message. A second call does nothing.                                                                                                                                                                                                                                                                                  |
| `send(payload, options?)`                 | Replies to an unanswered command or a modal sent from one, updates the message of an unanswered component or a modal from a message, and edits the answer once it's deferred or sent. A second `send()` edits again. After a private `followUp()` replaced a public deferral, it edits that follow-up. After `delete()` it sends a follow-up, as private as the deleted answer unless `flags` say otherwise, which becomes the answer.                                            |
| `edit(payload, options?)`                 | `send()` with an edit's payload type, so `Ephemeral` and `SuppressNotifications` don't compile. Before any answer it replies or updates, as `send()` does.                                                                                                                                                                                                                                                                                                                        |
| `followUp(payload, options?)`             | Another message after the answer. Before any answer, it's the first reply. After `delete()`, it's the new answer that `send()`, `edit()` and `delete()` act on.                                                                                                                                                                                                                                                                                                                   |
| `delete()`                                | Deletes the answer: a command's reply, the follow-up that replaced a public deferral, or, for a button, select menu or modal from a message, the message it's on. `message` is then `undefined` until something is sent. It throws before any answer, after `modal()`, and again with nothing sent since the last `delete()`.                                                                                                                                                     |
| `modal(modal)`                            | Shows a modal. It must be the first response, so this throws once the interaction is acknowledged, or while another answer is in flight.                                                                                                                                                                                                                                                                                                                                          |
| `error(error, { message?, visibility? })` | Shows an error in the [presenter's](guide:presenters) style, and never throws. `message` defaults to a `UserError`'s own message, or a generic sentence. `visibility: 'reply'`, the default, turns a public deferred reply into the error, which everyone sees. `'private'`, the default for a `UserError`, shows it only to the user who made the call. Elsewhere it's a private reply or follow-up (see [the fallback's table](guide:exception-filters#the-built-in-fallback)). |

`options` is `{ fill?: boolean }`. An embed with no colour, or a Components V2 container with no accent, takes the
theme's primary colour; `{ fill: false }` sends that one message as written.

## Private messages

A private message takes `flags: MessageFlags.Ephemeral`. Each call takes only the flags Discord accepts for it,
worked out afresh, so a private follow-up never makes the next message private. `send()` and `followUp()` payloads
are typed, so a flag no answer takes doesn't compile; one the call made can't take, such as `Ephemeral` on an edit, is
dropped, with a warning unless `NODE_ENV` is `production`. On a button or a select menu, `send()` updates the message
the member clicked, which can't be private: answer privately with `followUp()` and `MessageFlags.Ephemeral`.

While a command's reply is deferred and nothing has been sent, Discord turns a follow-up into that reply and ignores
its flags, so `followUp()` sends it as the edit. A private follow-up on a public deferral is the exception: the
deferral is deleted and the message is sent privately, rather than made public.

## Components V2 and attachments

Once a message uses Components V2, its edits keep the flag, and content and embeds are dropped from them. When an
edit or an update sends an embed or a Components V2 component again whose image, thumbnail, icon or file is one of
the message's own attachments, its URL is pointed at `attachment://`, so the file survives the edit. The loading and
error views a [presenter](guide:presenters) draws can carry files of their own; one added to a message by an edit
keeps the message's attachments.

## Gotchas

- **A handler that never answers leaves the user with "The application did not respond".** In development, MeoCord
  warns once per handler that ends without answering, or defers and never follows up, and names the handler. When an
  interceptor returned before the handler ran or finished, it names that interceptor instead, the outermost one when
  several did. Turn the warning on or off with `@MeoCord({ warnUnanswered })`. It's on by default when `NODE_ENV` is
  `development`, as under `meocord start --dev`.
- **`modal()` has to come first.** Call it before anything acknowledges the interaction, and leave
  [`@Defer`](guide:defer) off a handler that shows a modal, or use `@Defer({ mode: 'auto' })` and show the modal
  before it acknowledges.
- **A modal has no message to edit.** After `modal()`, `send()`, `edit()` and `delete()` throw, saying so. Answer in
  the handler of the modal's submit, which gets an interaction of its own.
- **`ephemeral: true` is deprecated.** discord.js deprecates it, and `respond()` reads it as the private flag only
  until 5.0, with a deprecation warning. Write `flags: MessageFlags.Ephemeral`.

## Next steps

- [@Defer](guide:defer): acknowledge before the guards run, and lock a component's message while the handler works.
- [Presenters](guide:presenters): style the loading and error views `respond()` shows for you.
- [Theming](guide:theming): the colour `respond()` fills in, and how to change it.
