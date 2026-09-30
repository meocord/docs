---
id: components
title: Buttons, selects and modals
chapter: interactions
order: 3
summary: Route buttons, select menus and forms to handlers by their customId, with parts of it captured as params.
learn:
  - Route a component to a handler with a customId pattern
  - Build customIds from a route, so button and handler agree
  - Read a select menu's choices and a form's fields
  - Leave a click to a discord.js collector
requires: [slash-commands]
api: [decorators/Command, utilities/route, responses/bindTheme, testing/resolveRoute]
since: 4.0.0
formerly: [component-routing, tutorial-components]
covers: [4.0/command-parameters, 4.1/command-parameters]
---

Buttons, select menus and modals, the forms a command can open, don't have names the way commands do. Each carries a
`customId` you choose when you send it, and MeoCord routes the interaction by matching that id against the patterns
in your `@Command` decorators. Parts of the id can be captured, so one handler serves every ticket, poll or profile.

## When to use it

Use a component whenever a member acts on a message the bot sent: a button to close a ticket, a menu to pick a role,
a form to write a report. A handler with a pattern is the right choice when the click should work any time, even
after the bot restarts, since the id alone says what to do.

For a short-lived choice that only matters for the next minute, such as a quick yes/no on one message, a discord.js
collector can be simpler: see [Collectors](#collectors).

## Example

::playground{file="controllers/button/profile.button.controller.ts" region="params" dispatch="button profile/123/800000001"}

The pattern `profile/{ownerId}/{uid}` matches a `customId` such as `profile/123/800000001`. The two parameters are
captured and arrive as the handler's second argument, as text; a parameter that names a type, such as
`{count:int}`, arrives as its value. See [Typed params](#typed-params).

## How it works

1. **At startup**, MeoCord collects every component pattern of every controller into one table, and ranks it: the
   most specific pattern first.
2. **When a component interaction arrives**, its `customId` is matched against the patterns of its component type,
   in that order, so a button never reaches a select menu's handler. The first that matches wins.
3. **The handler runs** through the [pipeline](guide:how-a-call-runs) with the interaction and the params: the
   captured values, plus a form's fields or a select menu's choices.

The component type comes from `@Command`'s second argument, such as `CommandType.BUTTON`, and decides which
discord.js interaction the handler receives:

| `CommandType`             | The handler receives               |
| ------------------------- | ---------------------------------- |
| `BUTTON`                  | `ButtonInteraction`                |
| `SELECT_MENU`             | `StringSelectMenuInteraction`      |
| `USER_SELECT_MENU`        | `UserSelectMenuInteraction`        |
| `ROLE_SELECT_MENU`        | `RoleSelectMenuInteraction`        |
| `MENTIONABLE_SELECT_MENU` | `MentionableSelectMenuInteraction` |
| `CHANNEL_SELECT_MENU`     | `ChannelSelectMenuInteraction`     |
| `MODAL_SUBMIT`            | `ModalSubmitInteraction`           |

## Patterns

`/` separates a pattern's segments, and a parameter must fill a whole segment. `profile/{uuid}` and
`gi-profile/{ownerId}` are fine, since the hyphen in the second is inside a literal segment. `profile-{uuid}` throws
as soon as `@Command` decorates the method:

```text
Invalid pattern "profile-{uuid}": {uuid} must occupy a whole segment, so it has to be
preceded and followed by "/" or by the ends of the pattern. Write "a/{uuid}" rather
than "a-{uuid}".
```

A parameter matches everything up to the next `/`, so an id you don't control, such as a uuid with hyphens, is
captured whole.

### Building customIds with a route

[`route()`](api:utilities/route) turns a pattern into a value `@Command` takes and that builds the ids it matches, so
the button you send and the handler that receives it share one definition:

::playground{file="controllers/button/ticket.button.controller.ts" region="route" dispatch="/ticket; button ticket/42/close"}

`build` takes exactly the pattern's params: a missing or unknown one fails to compile, and so does a handler whose
params name something the route doesn't capture. A `/` or `%` inside a value is encoded, and the handler receives it
decoded, so a value never spills into the next segment. An empty value, or an id longer than Discord's 100
characters, throws.

### Typed params

A parameter can name its type, `{name:type}`, and the handler receives the value rather than its text:

::playground{file="controllers/button/counter.button.controller.ts" region="typed" dispatch="button counter/41"}

| Type                          | The handler receives | A segment such as    |
| ----------------------------- | -------------------- | -------------------- |
| none, or `string`             | the text             | `abc`                |
| `int`, `number`               | a `number`           | `42`, `-3`; `2.5`    |
| `bool`                        | a `boolean`          | `true`, `off`, `yes` |
| words, such as `open\|closed` | one of the words     | `open`, as written   |

- **A segment of the wrong type matches no route**, so the next pattern is tried: `counter/lots` reaches no handler
  here.
- **`build` takes a value of each type**, and throws for one that wouldn't read back, such as `1.5` for an `int`.
- **The handler's params are checked when the code compiles**: `{ count: string }` for `{count:int}` is an error.
- **A customId holds text the bot wrote**, so there is no `member` or `channel` type, as a message command has. Capture
  the ID, `{userId}`, and fetch it in the handler; `{target:member}` stops the bot where it's declared.

### Overlapping patterns

Patterns with different segment counts never compete. When two with the same count can both match an id, the one that
spells out more literal text wins, whatever order they were declared in:

::playground{file="controllers/button/profile.button.controller.ts" region="overlap" dispatch="button profile/summary/456"}

Between equally literal patterns, the one with fewer parameters wins, then the one whose typed parameters take fewer
values: words to choose from, then `bool`, `int`, `number`, and text last. So beside `page/{name}`, `page/{n:int}` takes
`page/5` and leaves `page/last` to the other, in whatever order they're declared.

MeoCord warns at startup about every pair of patterns of one component type that can both take an id: the two above,
`page/{name}` and `page/{n:int}`, and `a/{x}/c` and `a/b/{y}`, which both take `a/b/c`. The bot still starts, and the
ranking decides which handler runs; [`findRouteConflicts`](api:testing/findRouteConflicts) lists the pairs. Patterns
with different literals in the same place, such as `profile/view/{uid}` and `profile/summary/{uid}`, never overlap.

Two handlers whose patterns match exactly the same ids, such as `profile/{uid}` and `profile/{id}`, stop the bot at
startup, naming both, since only one of them could ever run. `meocord register` refuses them too, before it sends any
command.

## Select menus

A select menu's handler receives what the member chose, beside the captured values:

::playground{file="controllers/select-menu/poll.select-menu.controller.ts" region="values" dispatch="select poll/lunch pizza,soup"}

| Select menu | Second argument, beside the captured values                                    |
| ----------- | ------------------------------------------------------------------------------ |
| String      | `values`: the chosen options' values                                           |
| User        | `values`, the chosen ids; `users`, the `User`s; `members`, those in the server |
| Role        | `values`; `roles`, the `Role`s                                                 |
| Channel     | `values`; `channels`, the channels                                             |
| Mentionable | `values`; `users`, `members` and `roles`, as they were chosen                  |

A user, role, mentionable or channel select is its own command type because Discord sends it with different resolved
data. Declaring `SELECT_MENU` for a user select is a type error rather than a silent mismatch:

::playground{file="controllers/select-menu/assign.select-menu.controller.ts" region="user-select" dispatch="userselect assign/7 13,14"}

## Modals

A form's handler receives its submitted fields, keyed by their `customId`, beside the captured values:

::playground{file="controllers/modal-submit/feedback.modal.controller.ts" region="modal" dispatch="modal feedback/42 body='The bot is fast.'"}

A command opens the form with `respond(interaction).modal(...)`, and its `customId` routes the submission here. When a
field or a choice shares a name with a captured value, the captured value wins, and development logs a warning.

## Collectors

A discord.js collector answers clicks on one message for a while, without a route. The click has no `@Command`
pattern, and the collector's callback answers it:

::example{file="controllers/button/poll.collector.controller.ts" region="collector"}

- **MeoCord leaves the click to the collector.** A button, select menu or modal submission no route takes, while
  anything else listens for the client's interactions, gets 1.5 seconds before MeoCord answers "Command not found!".
  If the collector answered by then, MeoCord says nothing, and the observers aren't told about it.
- **An app's own `@On('interactionCreate')` counts as a listener too**, so in such an app a genuinely dead button is
  answered after 1.5 seconds rather than at once.
- **Wrap the callback in [`bindTheme`](api:responses/bindTheme)** to answer in the theme of the handler that started
  the collector. Without it, the callback runs in the client's event, where the app's theme applies, not the
  handler's `@UseTheme`.

`awaitMessageComponent()` and `awaitModalSubmit()` work the same way, and keep the handler's theme across their
`await`.

## When nothing matches

An interaction no pattern takes raises `CommandNotFoundError`. The built-in fallback answers it with "Command not
found!" and logs a warning naming the `customId`. When a button seems dead, that log line is the first place to look.

To check which handler an id reaches without running it, use [`resolveRoute`](api:testing/resolveRoute):

::example{file="controllers/button/profile.button.controller.spec.ts"}

## Gotchas

- **A pattern that shares a segment with a parameter throws.** Write `ticket/{id}`, not `ticket-{id}`.
- **An untyped parameter is text.** `{ id: number }` for `{id}` converts nothing: write `{id:int}`, or use
  [Validation](guide:validation) to convert it.
- **A customId over 100 characters is refused by Discord.** Keep ids short: capture ids, not text.
- **A collector on an unrouted id delays dead buttons elsewhere.** While any collector is listening, a genuinely dead
  button in the app is answered after 1.5 seconds. Give long-lived components a route.

## Build it

Submitted feedback needs a place to live. A service keeps it in memory, and settings say where the review post goes,
read from `FEEDBACK_CHANNEL_ID`, which you add to `.env`. `staffRoleId`, who reviews it, is for
[Guards](guide:guards), later:

::example{file="tutorial/feedback.service.ts" region="service"}

::example{file="tutorial/feedback.settings.ts" region="settings"}

`get` throws a `FeedbackNotFoundError` for an id it doesn't know:

::example{file="tutorial/feedback.errors.ts" region="error"}

The feedback controller receives both through its constructor, and MeoCord creates them for it;
[Services](guide:services) explains how:

::example{file="tutorial/feedback.controller.ts" region="constructor"}

The `/feedback` form's `customId` is `feedback/submit`. Handle its submission: the member's fields arrive as params,
and the bot posts them for the staff with two review buttons whose ids carry the feedback's id:

::example{file="tutorial/feedback.controller.ts" region="submit"}

A message the bot posts with `channel.send` isn't one of MeoCord's answers, so it keeps Discord's default look;
[Theming](guide:theming) colours it. Now handle the review buttons, `feedback/{id}/approve` and
`feedback/{id}/reject`:

::example{file="tutorial/review.controller.ts" region="controller"}

`@Defer()` acknowledges each click before the handler runs, since saving the verdict, editing the post and sending a
DM can take longer than the three seconds Discord allows; [@Defer](guide:defer) covers it. The verdict goes through
`respond()`, so its embed takes the theme's primary colour. Add `ReviewController` to the app:

::example{file="tutorial/app.ts" region="app"}

Run `/feedback`, submit the form,
and click **Approve** in the review channel: the post gains the verdict, and the author gets a DM.

## Next steps

- [Answering with respond()](guide:responses): updates, follow-ups and forms.
- [@Defer](guide:defer): locking a component's buttons while a slow handler runs.
- [Autocomplete](guide:autocomplete): suggestions while a member types.
- [Validation](guide:validation): checking and converting captured values.
