---
id: select-menus
title: A role picker
chapter: appendix
group: recipes
order: 7
summary: A private menu of the roles members may give themselves, which updates their roles to match what they pick.
requires: [slash-commands, components, responses]
api: [decorators/Command, responses/respond]
since: 4.1.0
formerly: [recipe-select-menus]
---

`/roles` shows each member a private menu of the roles they may give themselves, with the ones they already have
selected. Picking updates their roles to match. It takes a string select menu, whose choices arrive in the handler's
params, and a check that keeps the menu to the roles it offers.

## The code

::example{file="recipes/select-menus/roles.ts" region="controller"}

## How it works

- **The choice as a param.** A select menu's handler receives the chosen options' values as `values`, beside any
  params its `customId` captures. `interaction.values` holds the same list. See
  [Select menus](guide:components#select-menus).
- **The whole set.** The menu shows the member's roles as selected, so a submission is their full choice: roles
  picked are added, and roles on the list left out are removed.
- **Only what was offered.** A client can send any value, so the handler keeps only ids on the list. Without the
  check, a forged submission could hand out any role the bot can manage.
- **Updating in place.** The menu is the private reply's own component, so `send()` updates that reply with the
  result and removes the menu.
- **Permissions.** The bot needs Manage Roles, and its highest role must be above every role on the list.

### Testing it

The spec submits an id the menu never offered, and checks that it's ignored:

::example{file="recipes/select-menus/roles.spec.ts" region="spec"}

## Variations

### Other menus

The same routing serves the four entity select menus, each with its own `CommandType`. A user select hands the handler
`users` and `members` beside `values`, a role select `roles`, a channel select `channels`, and a mentionable select
`users`, `members` and `roles`. Check what they send, as the handler here checks a string menu's values, before acting
on it.

## Next steps

- [Buttons, selects and modals](guide:components): every select menu, and what its handler receives.
- [Paginated lists](guide:recipes/pagination): buttons whose `customId` carries typed params.
- [Responses](guide:responses): replies, updates and private messages.
