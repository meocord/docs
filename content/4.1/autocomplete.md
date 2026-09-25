---
id: autocomplete
title: Autocomplete
section: Core
order: 15
---

Autocomplete is an interaction of its own: Discord sends it while the user is still typing an option, it is
answered with suggestions rather than a reply, and it has three seconds to answer. `@Autocomplete(command,
option)` binds a handler to it.

The option must be declared with `.setAutocomplete(true)`, which is what makes Discord send the interaction:

::example{file="controllers/slash/builders/search.builder.ts" region="builder"}

::example{file="controllers/slash/search.slash.controller.ts" region="controller"}

Leave out the option name to handle every option of the command, and branch on `getFocused(true)` yourself.
A handler for one option always wins over one for the whole command, so the two can live side by side. The
first argument is the command path, so subcommands work as they do for `@Command`:
`@Autocomplete('settings notify email', 'address')`.

The handler's second argument holds the options already filled in, which lets one option's suggestions
depend on another's value.

When no handler claims an option, MeoCord answers with an empty list and logs which command and option have
none, so the menu shows empty rather than loading forever.

In a test, `focused` names the option being typed:

::example{file="controllers/slash/search.slash.controller.spec.ts"}
