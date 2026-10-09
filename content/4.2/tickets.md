---
id: tickets
title: A ticket system
chapter: appendix
group: recipes
order: 4
summary: A /ticket form that opens a private thread with the member, and a Close button for them or the staff.
requires: [slash-commands, components, guards, cooldowns]
api:
  [
    utilities/route,
    decorators/Command,
    decorators/Cooldown,
    decorators/UseGuard,
    responses/respond,
    responses/GuardDeniedError,
  ]
since: 4.1.0
formerly: [recipe-tickets]
---

`/ticket` asks for a subject and details in a form, opens a private thread with the member in it, and posts a Close
button that the member or the staff can press. It takes a modal, a [cooldown](guide:cooldowns), discord.js threads,
and a [guard](guide:guards) with a rule of its own.

## The code

The command shows the form, and the form's submission opens the thread. The Close button's id comes from a route
that carries who opened the ticket:

::example{file="recipes/tickets/tickets.ts" region="controller"}

The guard lets through the member who opened the ticket, and anyone whose permissions include Manage Threads:

::example{file="recipes/tickets/tickets.ts" region="guard"}

## How it works

- **The form.** `respond(interaction).modal()` shows it, as the command's first answer. Its fields arrive as the
  submit handler's params, keyed by their `customId`. See [Modals](guide:components#modals).
- **The answer to the form.** A form opened from a command, not from a button on a message, has no message to
  update, so `send()` replies. The confirmation is private.
- **One ticket every ten minutes.** `@Cooldown({ uses: 1, seconds: 600 })` counts each member's calls apart. A second
  try in that time is told only to that member when they can try again, as a time Discord shows in their own language
  and counts down. The call is counted as the form opens, so a form closed without sending still counts.
- **Who can close it.** The route carries the id of the member who opened the ticket, and the guard reads it from
  the params. Anyone else is told privately why they can't, and the handler never runs.
- **Closing.** The handler updates the button's message, then locks and archives the thread, so members can still
  read it and no one can post.

### Testing it

::example{file="recipes/tickets/tickets.spec.ts" region="spec"}

## Variations

### Permissions

The bot needs Create Private Threads and Send Messages in Threads in the channel, and Manage Threads to lock a ticket as
it closes.

### Staff in the thread

Add a staff role's members with `thread.members.add`, or mention the role in the first message.

### A transcript

Before archiving, fetch the thread's messages with `thread.messages.fetch()` and post them as a file to a log
channel.

### One open ticket per member

Keep open tickets in a service, or [a database](guide:recipes/database), and point the member to the one they
already have.

## Next steps

- [Cooldowns](guide:cooldowns): whose calls count together, and where they're counted.
- [Buttons, selects and modals](guide:components): forms, and routes for the buttons.
- [A moderation command](guide:recipes/moderation): a confirmation held in a service.
