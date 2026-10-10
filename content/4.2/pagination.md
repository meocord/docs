---
id: pagination
title: Paginated lists
chapter: appendix
group: recipes
order: 1
summary: Show a long list a page at a time, with Previous and Next buttons only the member who asked can press.
requires: [slash-commands, components, guards, responses]
api: [utilities/route, decorators/Command, decorators/UseGuard, responses/respond, responses/GuardDeniedError]
since: 4.1.0
formerly: [recipe-pagination]
---

A leaderboard too long for one message, shown five entries at a time, with Previous and Next buttons that only the
member who asked can press. The buttons carry everything a click needs, so the bot keeps no state between clicks,
and they keep working after a restart.

## The code

A [route](guide:components#building-customids-with-a-route) holds the buttons' `customId`: who opened the board,
and the page a button leads to. The page is typed `int`, so it arrives as a number. One function builds a page and
its buttons from the route:

::example{file="recipes/pagination/leaderboard.ts" region="page"}

A guard lets only the member the button names press it:

::example{file="recipes/pagination/leaderboard.ts" region="guard"}

The command replies with the first page, and the button handler turns to the page its route names:

::example{file="recipes/pagination/leaderboard.ts" region="controller"}

## How it works

- **No state.** Each button's `customId`, such as `leaderboard/111111111111111111/2`, says whose board it is and which
  page it shows. Any click, however old, has what it needs.
- **One definition.** `@Command` takes the same `leaderboardPage` route that builds the ids, so the buttons and the
  handler can't drift apart, and `build` fails to compile without both params.
- **A number, checked.** `{page:int}` hands the handler a `number`. An id whose last segment isn't a whole number
  matches no route.
- **Updating in place.** A button's first answer is to its own message, so `respond(interaction).send()` updates
  the message the button is on rather than posting a new one. See [Responses](guide:responses#the-calls).
- **Only the owner.** The guard reads `ownerId` from the same params. It throws
  [`GuardDeniedError`](api:responses/GuardDeniedError), so anyone else is told why, privately, and the handler
  never runs. See [Guards](guide:guards).
- **Past the end.** A page past either end shows the nearest one, so an old message whose list has since shrunk
  still shows a page.

### Testing it

The spec builds a button's id from the route, and checks that an id with a page that isn't a number reaches no
handler:

::example{file="recipes/pagination/leaderboard.spec.ts" region="spec"}

## Variations

### Slow pages

If building a page queries a database, add [`@Defer()`](guide:defer) to the button handler. It acknowledges within
Discord's three seconds and locks the buttons while the page is built.

### Jumping to a page

A string select menu with one option per page routes the same way, with the page in the chosen value rather than
in its `customId`. See [Select menus](guide:components#select-menus).

## Next steps

- [Buttons, selects and modals](guide:components): patterns, typed params and routes.
- [Guards](guide:guards): what a guard can answer, and where it runs.
- [A role picker](guide:recipes/select-menus): a select menu whose choices arrive as params.
