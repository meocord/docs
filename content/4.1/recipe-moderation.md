---
id: recipe-moderation
title: A moderation command
section: Recipes
order: 72
since: 4.1.0
---

`/timeout`, which asks the moderator to confirm before it acts, logs what it did, and says so plainly when
Discord refuses for missing permissions. It uses a builder with default permissions, a pending action held in a
service, buttons guarded to the moderator, and an [exception filter](/docs/4.1/exception-filters).

## The command

The builder asks Discord to show the command only to members who can time others out, and only in servers:

::example{file="recipes/moderation/timeout.builder.ts" region="builder"}

Default permissions are a first line: a server's admins can change who sees a command, so the handler still
acts only through the bot's own permissions.

## Holding the proposal

A reason can be longer than a `customId` holds, so the proposal waits in a service, and the buttons carry its
id. `take()` removes it, so a double click, or a click after Cancel, does nothing:

::example{file="recipes/moderation/moderation.service.ts" region="service"}

## The handlers

::example{file="recipes/moderation/timeout.controller.ts" region="controller"}

## When Discord refuses

Discord answers 50013, Missing Permissions, when the bot's role lacks the permission or sits below the
member's highest role. The filter, on the whole controller, turns that into a message the moderator can act
on, and answers any other Discord error with the default one:

::example{file="recipes/moderation/missing-permissions.filter.ts" region="filter"}

## Testing it

::example{file="recipes/moderation/timeout.controller.spec.ts" region="spec"}

## Going further

- **Roles as well as permissions:** add `@RequireRoles('moderator')` from
  [Guards](/docs/4.1/guards#facts-about-the-handler) to the command.
- **A lasting log:** keep `record()` in a database, as in [A database](/docs/4.1/recipe-database), and post
  each entry to a log channel.
- **Restarts:** proposals live in memory, so a restart forgets them, and their buttons then answer that the
  action was already handled. Keep them in a database to survive one.
- **Expiring proposals:** remove proposals older than a few minutes, from a timer started in `onReady`.
