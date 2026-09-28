---
id: guards
title: Guards
chapter: pipeline
order: 2
summary: Decide whether a call may run, before the handler or anything costly sees it, and tell the user why when it may not.
learn:
  - Write a guard that allows or refuses a call
  - Apply guards to a handler, a controller or the whole bot
  - Give one use of a guard its own settings, checked when the code compiles
  - Read facts about the handler, and a message command's members and roles, from a guard
requires: [how-a-call-runs, services]
api:
  [
    decorators/Guard,
    decorators/UseGuard,
    types/GuardInterface,
    responses/GuardDeniedError,
    utilities/ExecutionContext,
    utilities/createMetadata,
    types/EntityRef,
    types/ParamRefsOf,
  ]
since: 4.0.0
formerly: [tutorial-guards]
---

A guard decides whether a handler runs. It's a class with one method, `canActivate`, which returns `true` to let the
call through and `false` to stop it. To tell the user why they were stopped, it throws
[`GuardDeniedError`](api:responses/GuardDeniedError) with the reason instead.

Guards run before anything that costs a request to Discord or counts a call, so a caller they refuse costs the bot
nothing.

## When to use it

Use a guard for who may run a handler, and where: a command only the staff may use, a button only the user who opened
it may press, a command that only works in some channels.

A limit on how often isn't a guard's job; use a [cooldown](guide:cooldowns). A check on the input's shape, such as a
number in range, belongs in [validation](guide:validation), which says exactly what's wrong.

## Example

This guard lets only the user whose ID a button's customId carries press it:

::example{file="guards/owner.guard.ts" region="guard"}

`canActivate` receives the handler's own arguments: the interaction, and the params its customId pattern captured.
A stranger pressing the button is told privately that it isn't theirs, and the handler never runs.

## How it works

A guard runs after [`@Defer`](guide:defer)'s acknowledgement and before everything else in the call: the fetch of a
message's entities, interceptors, validation, cooldowns and the handler.
[How a call runs](guide:how-a-call-runs) shows the whole order.

`canActivate` can be async. Its answer means:

| It                        | The call                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| returns `true`            | goes on to the next guard, then the rest of the call                 |
| returns `false`           | stops silently; observers see the outcome `'denied'`                 |
| throws `GuardDeniedError` | stops, and the user is told the error's message, only them           |
| throws `UserError`        | stops, and the user is told the message; observers see `'refused'`   |
| throws anything else      | goes to the [exception filters](guide:exception-filters) as an error |

The first guard that doesn't allow the call ends it; the ones after it don't run.

A new guard instance is made for every call, and it injects services like any class, so keep what must outlast one
call, such as counts, in a service.

## Where guards apply

[`@UseGuard`](api:decorators/UseGuard) goes on a handler, or on a controller for every handler it declares or
inherits. To guard every handler in the bot, list the guard in `@MeoCord({ guards })`. Global guards run first, then
the controller's, then the method's.

A controller's guards also guard every class that extends it, so a base controller can hold the rule for a whole
group of commands:

::example{file="controllers/slash/staff.slash.controller.ts" region="base"}

A subclass that shouldn't take its bases' guards for the handlers it declares sets
`@Controller({ inheritStages: false })`.

A guard runs for every kind of handler it applies to. Global guards also run before gateway event handlers, where
`canActivate` receives the event's arguments, such as a `GuildMember` for `guildMemberAdd`. A guard written for
interactions declares `@Guard({ types: ['interaction'] })`, and is skipped for any other call.

## Settings for one use

When a value configures one use of a guard, such as the channels a command is allowed in, pass it with
`{ provide, params }`. The guard reads it as `this.params`, and a guard that declares the type of its params has
every use checked against it when the code compiles:

::example{file="guards/channel.guard.ts" region="guard"}

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="typed"}

A guard that declares no params takes any. `params` is optional, so `{ provide: ChannelGuard }` works like the class
alone.

## Facts about the handler

For a fact about a handler that any guard can read, such as the IDs of the roles it requires, make a typed decorator
with [`createMetadata`](api:utilities/createMetadata). A guard reads it through
[`ExecutionContext`](api:utilities/ExecutionContext), which it injects, and a handler's value wins over its
controller's:

::example{file="guards/roles.guard.ts" region="guard"}

`RequireRoles` applies both the metadata and the guard, so a handler takes one decorator:

::example{file="controllers/slash/moderation.slash.controller.ts" region="apply"}

The guard checks role IDs, not names: discord.js keys a member's roles by ID, and anyone who manages roles can rename
one. Read your server's role IDs from `.env`, adding `ADMIN_ROLE_ID` and `MODERATOR_ROLE_ID` to it:

::example{file="guards/role-ids.ts" region="role-ids"}

A decorator reads them when your controller loads, and that works: MeoCord loads `meocord.config.ts`, and the
`dotenv/config` import at its top, before your application's code.

`ExecutionContext` also gives the guard the handler's params with `getHandlerParams()`, raw, before validation and
pipes, and the call's type, controller and handler. Only guards inject it; the other stages receive it as an argument.

## Members and roles in a message command

A [message command](guide:message-params) with a `member`, `user`, `role` or `channel` param fetches nothing from
Discord before its guards. Each such param reaches the guard as an [`EntityRef`](api:types/EntityRef), typed by
[`ParamRefsOf`](api:types/ParamRefsOf): its `id`, the entity as `cached` when discord.js already has it, and
`resolve()` to fetch it. A guard that needs the entity fetches it; one that doesn't costs no request. This one refuses
a caller without the permission silently, before any request, and tells one who doesn't outrank the target why:

::example{file="guards/outranks-target.guard.ts" region="guard"}

::example{file="controllers/message/economy.message.controller.ts" region="optionals"}

Once the guards let the call through, whatever the cache lacks is fetched, and the handler receives the entities
themselves.

## Refusing a call

`GuardDeniedError`'s message is shown only to the user who made the call:

- after an interaction, privately, as a reply or a follow-up, whichever the answer allows;
- after a message command, as a reply without a ping, deleted after
  `@MeoCord({ messages: { deleteUsageRepliesAfter } })` seconds.

A guard that denies a handler for every message, or an event handler, answers nothing, since it only filters what the
handler takes. Before an autocomplete, a guard must not answer at all: returning `false` closes the menu with an empty
list.

## Testing

The [testing module](guide:testing) runs guards as the bot does, and `invoke` resolves with `ran: false` when one
stopped the call:

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="invoke"}

A guard can also be tested alone, with `createExecutionContext` building the context it injects:

::example{file="controllers/slash/moderation.slash.controller.spec.ts" region="unit"}

## Gotchas

- **Returning `false` tells the user nothing.** On a button, that's often right. On a command, throw
  `GuardDeniedError` so they know why nothing happened.
- **A global guard runs before event handlers too.** One that reads `interaction.user` throws on an event; declare
  `@Guard({ types: ['interaction'] })`.
- **A guard bound once is shared.** Listing a guard in `services` or `providers` makes one instance for every call.
  Each call still reads its own `params`, but other fields are shared between calls in progress.
- **A controller method called directly runs its guards,** and nothing else of the pipeline. Test through `invoke` to
  run every stage.

## Build it

The staff channel shows each piece of feedback with Approve and Reject buttons, and anyone who can see the channel can
press them. Only the staff should decide, so add a guard that checks for the staff role. It reads the role from the
settings' `staffRoleId`, so add `STAFF_ROLE_ID` to `.env`, with your staff role's ID:

::example{file="tutorial/staff.guard.ts" region="guard"}

Apply it to both review buttons at once, on the controller:

::example{file="tutorial/review.controller.ts" region="step:guards"}

Press Approve as a member without the staff role. The bot tells only you that only the staff can review feedback, and
the post keeps its buttons. Press it as a member with the role, and the verdict is posted.

## Next steps

- [Validation and pipes](guide:validation): check the input a guard let through.
- [Exception filters](guide:exception-filters): answer a `GuardDeniedError` in your own words.
- [Testing recipes](guide:testing-recipes): test a guard with and without the role it needs.
