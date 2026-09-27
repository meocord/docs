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

::example{file="controllers/slash/profile.slash.controller.ts" region="respond"}

The handler acknowledges first, so the user sees "thinking…" while the profile loads. `send()` then edits that
deferred reply, since the interaction is no longer unanswered, and `followUp()` adds a private tip.

A test sees the calls it made:

::example{file="controllers/slash/profile.slash.controller.spec.ts"}

A call Discord refused stays in `calls`, in the order it was made, with the error it rejected with as `error`, and
doesn't count towards `sent`. A reply refused with 10062, once the three seconds have passed, reports `sent: false`,
so a test of what the user sees after a slow handler fails as the user would.

## How it works

`respond(interaction)` returns the same object for the whole life of one interaction, so a helper, a guard and the
handler all see one answer. Interceptors and exception filters reach it as `context.response`.

Before each call, it reads where the answer stands from the interaction itself, as `state`: `'unanswered'`,
`'deferred'` or `'replied'`. Answers made directly through discord.js, or by a collector, count too.

## The calls

| Call                                    | What it does                                                                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `acknowledge({ ephemeral })`            | Buys time: a deferred reply for a command, shown as "thinking…", or an invisible deferred update for a component. A second call does nothing.                |
| `send(payload, options?)`               | Replies to an unanswered command, updates an unanswered component's message, and edits the answer once it's deferred or sent. A second `send()` edits again. |
| `edit(payload, options?)`               | Edits the answer, as `send()` does once answered.                                                                                                            |
| `followUp(payload, options?)`           | Another message after the answer.                                                                                                                            |
| `delete()`                              | Deletes the answer.                                                                                                                                          |
| `modal(modal)`                          | Shows a modal. It must be the first response, so this throws once the interaction is acknowledged.                                                           |
| `error(error, { message, visibility })` | Shows an error in the [presenter's](guide:presenters) style, and never throws. `'private'` shows it only to the user who made the call.                      |

`options` is `{ fill?: boolean }`. An embed with no colour, or a Components V2 container with no accent, takes the
theme's primary colour; `{ fill: false }` sends that one message as written.

## Private messages

A private message takes `flags: MessageFlags.Ephemeral`. Each call takes only the flags Discord accepts for it,
worked out afresh, so a private follow-up never makes the next message private. `send()` and `followUp()` payloads
are typed, and a flag a call can't take doesn't compile.

While a command's reply is deferred and nothing has been sent, Discord turns a follow-up into that reply and ignores
its flags, so `followUp()` sends it as the edit. A private follow-up on a public deferral is the exception: the
deferral is deleted and the message is sent privately, rather than made public.

## Components V2 and attachments

Once a message uses Components V2, its edits keep the flag, and content and embeds are dropped from them. When an
edit sends an embed again whose image is one of the message's own attachments, the image's URL is pointed at
`attachment://`, so the image survives the edit.

## Gotchas

- **A handler that never answers leaves the user with "The application did not respond".** In development, MeoCord
  warns once for each handler that ends without answering, or defers and never follows up, and names it. Turn the
  warning on or off with `@MeoCord({ warnUnanswered })`.
- **`modal()` has to come first.** Call it before anything acknowledges the interaction, and leave
  [`@Defer`](guide:defer) off a handler that shows a modal.
- **`ephemeral: true` is deprecated in discord.js.** It's still read as the private flag, but write
  `flags: MessageFlags.Ephemeral` in new code.

## Next steps

- [@Defer](guide:defer): acknowledge before the guards run, and lock a component's message while the handler works.
- [Presenters](guide:presenters): style the loading and error views `respond()` shows for you.
- [Theming](guide:theming): the colour `respond()` fills in, and how to change it.
