---
id: autocomplete
title: Autocomplete
chapter: interactions
order: 4
summary: Suggest values for a slash command's option while the member is still typing it.
learn:
  - Turn on autocomplete for an option in its builder
  - Answer with suggestions from an @Autocomplete handler
  - Base one option's suggestions on another's value
requires: [slash-commands]
api: [decorators/Autocomplete]
since: 4.0.0
---

Autocomplete fills Discord's option menu with suggestions as a member types: a product name, a city, a ticket
number. Discord sends it as an interaction of its own, while the command hasn't been run yet, and it's answered with a
list of choices rather than a reply.

## When to use it

Use it when an option's valid values are too many for fixed choices, or change over time: the catalog, the member's
own tickets, a search. Discord allows at most 25 fixed choices, and they're baked into the command when it's
registered.

For a handful of values that never change, fixed choices with `.addChoices(...)` in the builder are simpler, and need
no handler. Autocomplete only suggests: the member can still send any value, so check it in the command's handler, or
with [Validation](guide:validation).

## Example

`setAutocomplete(true)` on the option is what makes Discord send the autocomplete interaction:

::example{file="controllers/slash/builders/search.builder.ts" region="builder"}

::example{file="controllers/slash/search.slash.controller.ts" region="controller"}

`@Autocomplete('search', 'query')` binds `completeQuery` to the `query` option of `/search`. It reads what the member
has typed so far, and answers with up to 25 matches from the catalog. The command itself is handled by `search`, as
any slash command is.

## How it works

1. **As the member types**, Discord sends an `AutocompleteInteraction` for the option being typed, again for each
   change.
2. **MeoCord finds the handler** by the command's path and the focused option's name. A handler for one option wins
   over one for the whole command, so the two can live side by side.
3. **The handler runs** with its guards and exception filters, but no interceptors, validation, cooldowns or `@Defer`:
   it has three seconds and answers only once. A controller's `@Cooldown` skips it, and `@Validate`, `@UsePipe`,
   `@Cooldown` or `@Defer` on the handler itself stops the bot at startup.
4. **It answers** with discord.js's `interaction.respond(choices)`, not `respond()`, since an autocomplete can't be
   replied to.

The handler's second argument holds the options the member has already filled in, so one option's suggestions can
depend on another's value.

## One handler for every option

Leave out the option name, `@Autocomplete('search')`, to handle every autocompleted option of the command, and branch
on `interaction.options.getFocused(true).name` yourself.

## Autocomplete in a subcommand

The first argument is the command path, so subcommands work as they do for `@Command`:
`@Autocomplete('settings notify email', 'address')`. See [Subcommands](guide:subcommands).

## When no handler claims an option

MeoCord answers with an empty list, and logs which command and option have no handler, so the menu shows empty rather
than loading until it times out. An error in the handler does the same, after the error reaches the handler's
filters.

## Gotchas

- **More than 25 choices are refused.** Discord rejects the whole answer, and the menu shows nothing. Slice the list,
  as the example does.
- **A slow lookup misses the three seconds.** Autocomplete can't be deferred. Keep the lookup fast: cache what it
  searches, or search a smaller index.
- **A suggestion isn't a guarantee.** The member can ignore it and send anything. Check the value when the command
  runs.
- **Only one handler completes an option.** With two `@Autocomplete` handlers for the same option of one command
  path, or for every option of one path, the one in the controller listed first runs, and the other never does. The
  bot warns at startup, naming both, and in the next major version (5.0) it refuses to start. Keep one, or give the
  other an option or a path of its own.

## Next steps

- [Context menus](guide:context-menus): commands on a user or a message.
- [Validation](guide:validation): checking the value the member finally sends.
- [Mocks](guide:mocks#options-and-fields): testing an autocomplete handler, with `focused` naming the option typed in.
