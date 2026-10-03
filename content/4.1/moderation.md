---
id: moderation
title: A moderation command
chapter: appendix
group: recipes
order: 3
summary: A /timeout command that asks the moderator to confirm, logs what it did, and explains a missing permission.
requires: [slash-commands, components, guards, exception-filters, services]
api:
  [
    utilities/route,
    decorators/Command,
    decorators/UseGuard,
    decorators/UseFilter,
    decorators/Catch,
    responses/respond,
    responses/GuardDeniedError,
  ]
since: 4.1.0
formerly: [recipe-moderation]
---

`/timeout` asks the moderator to confirm before it acts, logs what it did, and says so plainly when Discord refuses
for a missing permission. It takes a builder with default permissions, a proposal held in a service, buttons only
the moderator can press, and an [exception filter](guide:exception-filters).

## The code

The builder asks Discord to show the command only to members who can time others out, and only in servers:

::example{file="recipes/moderation/timeout.ts" region="builder"}

A reason can be longer than a `customId` holds, so the proposal waits in a service, and the buttons carry its id.
`take()` removes it, so a double click, or a click after Cancel, does nothing:

::example{file="recipes/moderation/timeout.ts" region="service"}

A guard lets only the moderator the button names press it:

::example{file="recipes/moderation/timeout.ts" region="guard"}

The command proposes, privately, and one handler takes both buttons:

::example{file="recipes/moderation/timeout.ts" region="controller"}

A filter on the controller turns Discord's refusal into a message the moderator can act on:

::example{file="recipes/moderation/timeout.ts" region="filter"}

## How it works

- **Default permissions** are a first line only. A server's admins can change who sees a command, so the handler
  acts through the bot's own permissions, and Discord checks those.
- **One route, two answers.** `{action:confirm|cancel}` takes one of the two words, and the handler receives it
  typed as `'confirm' | 'cancel'`. `{id:int}` gives it the proposal's id as a number. See
  [Typed params](guide:components#typed-params).
- **Once only.** The first click takes the proposal, so a second click on either button answers that it was
  already handled, and times no one out.
- **Only the moderator.** The proposal is private, so only the moderator sees its buttons. The guard checks anyway,
  reading `ownerId` from the route's params and throwing [`GuardDeniedError`](api:responses/GuardDeniedError), so any
  other click is refused privately.
- **When Discord refuses.** Discord answers `MissingPermissions`, 50013, when the bot's role lacks Moderate Members, or
  sits below the member's highest role. `member.timeout()` rejects, and the filter answers that in words the moderator
  can act on, privately. Any other Discord error gets the default message, privately, and isn't logged, since the filter
  handled it; log it in the filter to keep it.

### Testing it

The spec confirms, cancels, and makes `timeout()` reject as Discord would:

::example{file="recipes/moderation/timeout.spec.ts" region="spec"}

## Variations

### Roles as well as permissions

To require a role too, apply the `RequireRoles` decorator built in
[Guards](guide:guards#facts-about-the-handler) to the command. Pass role IDs, not names: the guard checks the
member's roles by ID. Read it from the environment, such as
`@RequireRoles(process.env.MODERATOR_ROLE_ID ?? '')`: the same `MODERATOR_ROLE_ID` the Guards page uses, so you set it
once. An unset ID denies every call.

### A lasting log

Keep `record()` in a database, as in [A database](guide:recipes/database), and post each entry to a log channel.

### Restarts

Proposals live in memory, so a restart forgets them, and their buttons then answer that the action was already handled.
Their ids count from when the bot started, so a button from before a restart never matches a proposal made after it.
Keep proposals in a database to survive one.

### Expiring proposals

Remove proposals older than a few minutes, from a timer started in `onReady` and cleared in `onShutdown`. See
[Scheduled tasks](guide:recipes/scheduled).

## Next steps

- [Exception filters](guide:exception-filters): which filter catches an error, and what it can answer.
- [Buttons, selects and modals](guide:components): routes and typed params.
- [A ticket system](guide:recipes/tickets): a guard with a rule of its own.
