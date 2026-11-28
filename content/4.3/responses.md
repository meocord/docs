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

- An acknowledgement that fails, other than with 40060, leaves the interaction unanswered, so the next `send()` replies
  rather than throwing that failure again.
- A reply or an update refused with 40060, because the interaction was answered elsewhere, still throws, and the next
  `send()` edits that answer.
- An acknowledgement refused with 40060 doesn't throw: it counts as answered, and the next `send()` edits that answer.
  That answer may be a reply, so `lock()` draws nothing over it.

## The calls

| Call                                      | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acknowledge({ ephemeral })`              | Buys time: a deferred reply for a command or a modal sent from one, shown as "thinking…", or an invisible deferred update for a component or a modal a component opened. A second call does nothing.                                                                                                                                                                                                                                                                                                                                    |
| `send(payload, options?)`                 | Replies to an unanswered command or a modal sent from one, updates the message of an unanswered component or a modal a component opened, and edits the answer once it's deferred or sent. A second `send()` edits again. After a private `followUp()` replaced a public deferral, it edits that follow-up. After `delete()` it sends a follow-up, as private as the deleted answer unless `flags` say otherwise, which becomes the answer.                                                                                              |
| `edit(payload, options?)`                 | `send()` with an edit's payload type, so `Ephemeral` and `SuppressNotifications` don't compile. Before any answer it replies or updates, as `send()` does.                                                                                                                                                                                                                                                                                                                                                                              |
| `followUp(payload, options?)`             | Another message after the answer. Before any answer, it's the first reply. After `delete()`, it's the new answer that `send()`, `edit()` and `delete()` act on.                                                                                                                                                                                                                                                                                                                                                                         |
| `delete()`                                | Deletes the answer: a command's reply, the follow-up that replaced a public deferral, or, for a button, a select menu, or a modal one of them opened, the message it's on. `message` is then `undefined` until something is sent. It throws before any answer, after `modal()`, and again with nothing sent since the last `delete()`.                                                                                                                                                                                                  |
| `modal(modal)`                            | Shows a modal. It must be the first response, so this throws once the interaction is acknowledged, or while another answer is in flight.                                                                                                                                                                                                                                                                                                                                                                                                |
| `error(error, { message?, visibility? })` | Shows an error in the [presenter's](guide:presenters) style, and never throws. `message` defaults to a `UserError`'s own message, or a generic sentence. `visibility: 'reply'`, the default, turns a public deferred reply into the error, which everyone sees. `'private'`, the default for a `UserError`, shows it only to the user who made the call. Elsewhere it's a private reply or follow-up, and a select-menu pick is first put back in its menu (see [the fallback's table](guide:exception-filters#the-built-in-fallback)). |

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

## Mentions

`respond()` sets no `allowedMentions` of its own, so its answers follow `clientOptions.allowedMentions`, the default
for every message the client sends. `npx {{meocord}} create` sets it to `{ parse: [] }`, so an answer pings no one,
whoever its text mentions. An answer that posts a message, a command's first reply when neither `acknowledge()` nor
[`@Defer`](guide:defer) deferred it, or a follow-up after the first answer, pings whoever its own `allowedMentions`
allows: as such a reply, `send({ content, allowedMentions: { users: [member.id] } })` pings that member and no one
else. See
[Security](guide:security#ask-for-little).

## Components V2 and attachments

A Components V2 message carries only components. `respond()` edits an answer in that answer's own format: a V2 reply,
sent through `respond()` or with the app's own `interaction.reply()`, is edited as V2, and so is a V2 follow-up that
became the answer, by replacing a public deferral or after `delete()`. discord.js keeps no flags of a reply the app
sent itself, so `respond()` reads it back once with `fetchReply()` before its first edit. It reads nothing back after
a `deferReply()`, an `update()` or a `deferUpdate()`, whose format it knows. On a button, a select menu or a modal, the
app's own reply or deferral keeps its own format, whatever the message the component is on; MeoCord's own error
messages follow that message.

Once an answer uses Components V2, its edits keep the flag. An edit or an update that makes an embed answer V2 clears
its content and embeds in the same request, with `content: null` and `embeds: []`, as Discord requires. Content or
embeds sent to a V2 answer are dropped, with a warning naming the interaction and what was dropped: send that text as
components, such as a Text Display.

### What an edit keeps

A message's uploads are the files sent with it. On a Components V2 message, Discord lists them only in the media that
show them, each gallery item, thumbnail and File with its `attachment_id`, and `message.attachments` holds only the
uploads nothing shows. An embed's image, thumbnail and icons are left out of `attachments` too. Each edit `respond()`
makes keeps the uploads the message shows, unless the app gives its own `attachments` list:

- Media and embed images that point at the message's own uploads go out as `attachment://<filename>`, so each upload
  stays attached. Sent back with its CDN URL instead, a gallery item becomes a plain link to its signed CDN URL, and
  Discord refuses a File.
- An edit with neither `files` nor `attachments` keeps every upload.
- An edit that adds `files` without `attachments` lists the uploads it shows beside the new files. When those and the
  new files pass Discord's limit of 10, it keeps only the new files, with a warning naming the uploads that go.
- A new file named like a shown upload replaces it: `attachment://<name>` reaches the new file.
- An `attachments` list the app gives is sent as given: no entry is added, removed or reordered. A discord.js
  `Attachment` in it, and an entry with only the `id` of one of the message's uploads, go out as `{ id, filename }`,
  the shape Discord needs to keep a Components V2 component's upload.

To drop files, list the ones to keep, or pass `attachments: []`. Media the edit still shows of an upload the list
leaves out is sent as given and breaks: a gallery item reads back not found, Discord refuses a File, and an embed's
images are left as links to their signed CDN URLs in place of their uploads. Remove that media too, or keep its upload
listed; `respond()` warns once per edit, naming such uploads. On a V2 message, `[...message.attachments.values()]`
holds none of the uploads its components show, so listing it drops them all.

`original` holds the message's components and embeds as Discord delivered them, their media as CDN URLs. Re-send them
through `send()` or `edit()`, which keep the uploads; a direct `interaction.editReply()` or `message.edit()` sends the
CDN URLs as they are.

The loading and error views a [presenter](guide:presenters) draws can carry files of their own. A lock or an error
lists a view's files beside the uploads the message keeps, and all of them count toward the limit of 10. A view whose
files would pass it, or one with a file named like a kept upload, which would take its `attachment://`, is sent
without its files, with a warning.

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
- [Formatting](guide:formatting): split a long answer into a reply and follow-ups, and fit text to Discord's limits.
