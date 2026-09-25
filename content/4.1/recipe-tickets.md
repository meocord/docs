---
id: recipe-tickets
title: A ticket system
section: Recipes
order: 73
since: 4.1.0
---

`/ticket` asks for a subject and details in a modal, opens a private thread with the member in it, and posts
a Close button that the member or the staff can press. It uses a modal, a [cooldown](/docs/4.1/cooldowns),
discord.js threads and a [guard](/docs/4.1/guards) with a rule of its own.

## The command and the modal

The command answers with a modal, whose fields arrive as the submit handler's params. A modal opened from a
command, rather than from a button on a message, is answered with a new message, so the member's
confirmation is a private reply:

::example{file="recipes/tickets/ticket.controller.ts" region="controller"}

`@Cooldown({ uses: 1, seconds: 600 })` lets each member open one ticket every ten minutes; a second try in
that time is answered privately with how long to wait.

## Who can close it

The Close button carries the id of the member who opened the ticket. The guard lets them through, and
anyone whose permissions include Manage Threads:

::example{file="recipes/tickets/ticket-closer.guard.ts" region="guard"}

Closing updates the button's message, then locks and archives the thread, so members can still read it and
no one can post.

## Testing it

::example{file="recipes/tickets/ticket.controller.spec.ts" region="spec"}

## Going further

- **Permissions.** The bot needs Create Private Threads and Send Messages in Threads in the channel.
- **Staff in the thread.** Add a staff role's members with `thread.members.add`, or mention the role in the
  first message.
- **A transcript.** Before archiving, fetch the thread's messages with `thread.messages.fetch()` and post
  them as a file to a log channel.
- **One open ticket per member.** Keep open tickets in a service, or [a database](/docs/4.1/recipe-database),
  and point the member to the one they have.
