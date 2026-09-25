---
id: autocomplete
title: 'Autocomplete'
order: 10
source: readme@4.0.0
---

Autocomplete is a separate interaction from the command it belongs to: Discord sends it while the user is still typing, it is answered with `respond()` rather than a reply, and the window closes after three seconds. `@Autocomplete` binds a handler to it.

```typescript
@Controller()
export class SearchController {
  constructor(private catalog: CatalogService) {}

  @Autocomplete('search', 'query')
  async completeQuery(interaction: AutocompleteInteraction) {
    const { value } = interaction.options.getFocused(true)
    const matches = this.catalog.find(value).slice(0, 25)

    await interaction.respond(matches.map(name => ({ name, value: name })))
  }
}
```

The option must be declared with `.setAutocomplete(true)` on the command builder — that is what makes Discord send the interaction.

Omit the option name to handle every option of a command and branch on `getFocused(true)` yourself. An option-specific handler always wins over a command-wide one, so the two can coexist. The first argument is the command path, so subcommands work the same way as they do for `@Command`:

```typescript
@Autocomplete('settings notify email', 'address')
async completeAddress(interaction: AutocompleteInteraction, { region }) { /* … */ }
```

The second argument holds the options already filled in, which is what lets one option's suggestions depend on another's value.

If no handler claims an option, MeoCord answers with an empty list and logs which command and option are missing one — a visibly empty menu rather than a client stuck loading.

---
