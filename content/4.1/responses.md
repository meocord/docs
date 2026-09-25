---
id: interaction-responses
title: Answering with respond()
section: Answering Discord
order: 20
since: 4.1.0
---

Discord has a different call for each state an interaction's answer can be in: `reply` for a first answer,
`deferReply` and `deferUpdate` to buy time, `editReply` once deferred, `update` for a component's message,
`followUp` for another message. Pick the wrong one and Discord rejects it. `respond(interaction)` from
`meocord/common` keeps track of where the answer stands and makes the right call, so a handler says what to
send, not how.

::example{file="controllers/slash/profile.slash.controller.ts" region="respond"}

A test sees the calls it made:

::example{file="controllers/slash/profile.slash.controller.spec.ts"}

## The calls

| Call                                    | What it does                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acknowledge({ ephemeral })`            | Buys time: a deferred reply for a command, shown as "thinking…"; an invisible deferred update for a component, or a modal submitted from a message. Once only. |
| `send(payload)`                         | Replies to an unanswered command, updates an unanswered component's message, and edits the answer once it is deferred or sent. A second `send()` edits again.  |
| `edit(payload)`                         | Edits the answer, as `send()` does once answered.                                                                                                              |
| `followUp(payload)`                     | Another message after the answer.                                                                                                                              |
| `delete()`                              | Deletes the answer.                                                                                                                                            |
| `modal(modal)`                          | Shows a modal. It must be the first response, so this throws once the interaction is acknowledged.                                                             |
| `error(error, { message, visibility })` | Shows an error in the [presenter's](/docs/4.1/presenters) style, and never throws. `'private'` shows it only to the user who made the call.                    |

`state` tells where the answer stands, `'unanswered'`, `'deferred'` or `'replied'`. It is read from the
interaction on every call, so answers made directly through discord.js, or by a collector, still count.

## Flags

Each call takes only the flags Discord accepts for it, worked out afresh: a private follow-up never makes
the next message private. `send()` and `followUp()` payloads are typed, so a flag a call cannot take does not
compile.

While a command's reply is deferred and nothing has been sent, Discord turns a follow-up into that reply
and ignores its flags, so `followUp()` sends it as the edit. A private follow-up on a public deferral is
the exception: the deferral is deleted and the message sent privately, rather than made public.

## Components V2 and attachments

Once a message uses Components V2, its edits keep the flag, and content and embeds are dropped from them.
When an edit sends an embed again whose image is one of the message's own Discord attachments, the image's
URL is pointed at `attachment://`, so the image survives the edit.

## Where to reach the same state

`respond(interaction)` returns the same object every time for one interaction, so a helper, a guard and the
handler all see one answer. Interceptors and exception filters reach it as `context.response`. For a handler
that acknowledges on its own, `lock()` is [`@Defer`](/docs/4.1/defer)'s second step.
