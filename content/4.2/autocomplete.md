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

For a handful of values that never change, fixed choices with `.addChoices(...)` in the builder are simpler, and need no
handler. An option has one or the other: discord.js refuses `setAutocomplete(true)` together with `.addChoices(...)`,
and the controller fails to load. Autocomplete only suggests: the member can still send any value, so check it in the
command's handler, or with [Validation](guide:validation).

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
2. **MeoCord finds the handler** by the command's path and the focused option's name. It tries the full path, then
   the command's name, as for commands, and runs the first handler that claims the focused option. At one path, a
   handler for that option wins over one for the whole command, so the two can live side by side.
3. **The handler runs** with its guards and exception filters, but no interceptors, validation, cooldowns or `@Defer`:
   it has three seconds and answers only once. A controller's `@Cooldown` skips it, and `@Validate`, `@UsePipe`,
   `@Cooldown` or `@Defer` on the handler itself stops the bot at startup.
4. **It answers** with discord.js's `interaction.respond(choices)`, not `respond()`, since an autocomplete can't be
   replied to.

The handler's second argument holds the options the member has already filled in, so one option's suggestions can depend
on another's value. Those options arrive as Discord sends them during typing: a user, role, channel or attachment option
is its id, not the resolved object a command handler gets, and the option being typed holds its partial text. Fetch what
you need from the id, such as `interaction.guild?.members.fetch(userId)`.

A test reads them the same way under [`useStrictMocks()`](api:testing/useStrictMocks): an entity option given to
[`createChatInputOptions`](api:testing/createChatInputOptions) holds only its id in an autocomplete, and its getters,
such as `getUser()`, return `null`. In default mode the object is kept, with a warning that names the options once.

## One handler for every option

Leave out the option name, `@Autocomplete('search')`, to handle every autocompleted option of the command, and branch
on `interaction.options.getFocused(true).name` yourself.

## Autocomplete in a subcommand

The first argument is the command path, so subcommands work as they do for `@Command`:
`@Autocomplete('settings notify email', 'address')`. See [Subcommands](guide:subcommands).

A handler on the command's name alone covers every subcommand and group: `@Autocomplete('settings', 'address')`
answers `address` in `settings notify email` and in any other subcommand that has it. A path stops at a subcommand,
never at a group: `@Autocomplete('settings notify', 'address')`, for the group `notify`, never runs, and the bot says
so at startup.

## When no handler claims an option

MeoCord answers with an empty list, and logs which command and option have no handler, so the menu shows empty rather
than loading until it times out. An error no filter handles does the same. A filter that catches the handler's own error
must answer it itself, with `interaction.respond([])`: once the handler has run, MeoCord doesn't close the menu, so it
fails to load unless the filter answers. After a guard's error, MeoCord still closes the menu if the filter didn't.

## Gotchas

- **More than 25 choices, or a name or value longer than 100 characters, are refused.** Discord rejects the whole
  answer, and the menu shows nothing. Slice the list, as the example does, and shorten long names.
- **A slow lookup misses the three seconds.** Autocomplete can't be deferred. Keep the lookup fast: cache what it
  searches, or search a smaller index.
- **A handler that returns without `interaction.respond()` leaves the options failing to load.** In development,
  MeoCord names it once, as it names any handler that ends without answering. `@MeoCord({ warnUnanswered })` turns it
  on or off.
- **A handler for an option without autocomplete never runs.** Discord never asks to complete it. The bot warns at
  startup, and in the next major version (5.0) it refuses to start; turn it on in the builder with
  `setAutocomplete(true)`.
- **A suggestion isn't a guarantee.** The member can ignore it and send anything. Check the value when the command
  runs.
- **Only one handler completes an option.** With two `@Autocomplete` handlers for the same option of one command path,
  or for every option of one path, the one whose controller is listed first, or within one controller the one declared
  first, runs, and the other never does. The bot warns at startup, naming both, and in the next major version (5.0) it
  refuses to start. Keep one, or give the other an option or a path of its own.

## Next steps

- [Context menus](guide:context-menus): commands on a user or a message.
- [Validation](guide:validation): checking the value the member finally sends.
- [Mocks](guide:mocks#options-and-fields): testing an autocomplete handler, with `focused` naming the option typed in.
