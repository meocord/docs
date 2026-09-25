---
id: recipe-pagination
title: Paginated lists
section: Recipes
order: 70
since: 4.1.0
---

A leaderboard too long for one message, shown five entries at a time, with Previous and Next buttons that
only the user who asked can press. It uses a slash command, a [component route](/docs/4.1/component-routing)
with params, a [guard](/docs/4.1/guards) and [`respond()`](/docs/4.1/responses).

## The page

One function builds a page and its buttons. Each button's `customId` carries who opened the board and the
page it leads to, so the bot keeps no state between clicks, and the buttons keep working after a restart:

::example{file="recipes/pagination/leaderboard.page.ts" region="page"}

## The handlers

The command replies with the first page. The button handler reads the page from its params, and
`respond().send()` updates the message the button is on, since that is the first answer to a component.
`OwnerGuard` reads `ownerId` from the same params and refuses anyone else, privately:

::example{file="recipes/pagination/leaderboard.controller.ts" region="controller"}

::example{file="guards/owner.guard.ts" region="guard"}

## Testing it

::example{file="recipes/pagination/leaderboard.controller.spec.ts" region="spec"}

## Going further

- **A page past the end** is clamped, so an old message whose list has since shrunk still shows a page.
- **Long waits:** if building a page queries a database, add [`@Defer()`](/docs/4.1/defer) to the button
  handler, which acknowledges within Discord's three seconds and locks the buttons while it works.
- **Jumping to a page:** a string select menu with one option per page routes the same way, with the page
  in its value rather than its `customId`.
