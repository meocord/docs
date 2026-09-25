---
id: recipe-select-menus
title: A role picker
section: Recipes
order: 76
since: 4.1.0
---

`/roles` shows each member a private menu of the roles they may give themselves, with the ones they have
already selected; picking updates their roles to match. It uses a string select menu, its values, and a check
that keeps the menu to the roles it offers.

## The handlers

::example{file="recipes/select-menus/roles.controller.ts" region="controller"}

- **The whole set.** The menu shows the member's roles as selected, so a submission is their full choice:
  roles picked are added, and roles on the list left out are removed.
- **Only what was offered.** A client can send any value, so the handler keeps only ids on the list. Without
  the check, a forged submission could hand out any role the bot can manage.
- **Permissions.** The bot needs Manage Roles, and its highest role must be above every role on the list.

## Testing it

The spec submits an id the menu never offered, and checks it is ignored:

::example{file="recipes/select-menus/roles.controller.spec.ts" region="spec"}

## Other menus

The same routing serves the four entity select menus, each with its own `CommandType`: a user select menu
hands the handler the users picked, as in [Commands and components](/docs/4.1/command-types). Check what they
send as you would a string menu's values, before acting on it.
