---
id: localisation
title: "Localisation"
order: 22
source: readme@4.1.0-beta.0
---

One catalog of messages per locale, typed from the default one, serves command names and descriptions and the bot's replies. Keys, the params each message takes and plural forms are all checked at compile time; nothing is added to your dependencies.

```typescript
// src/locales/en-US.ts — the default catalog, which every other locale is checked against
import { defineCatalog } from 'meocord/common'

export default defineCatalog({
  ban: { name: 'ban', description: 'Ban a member', done: 'Banned {user}.' },
  warnings: { one: '{user} has {count} warning', other: '{user} has {count} warnings' },
})
```

```typescript
// src/locales/id.ts — any part of the default catalog; what it leaves out falls back
export default { ban: { name: 'blokir', description: 'Blokir anggota', done: '{user} diblokir.' } }
```

```typescript
// src/i18n.ts — at module scope, because command builders run when their class is decorated
import { createTranslator } from 'meocord/common'
import enUS from '@src/locales/en-US'
import id from '@src/locales/id'

export const t = createTranslator({ default: 'en-US', locales: { 'en-US': enUS, id } })
```

Locales are discord.js `Locale` values: `en-GB`, `es-419`, `zh-TW`, and so on; a bare `en` is refused.

**Commands.** A builder uses the translator directly. `t.localizations(key)` returns only the locales whose catalog has the message, so Discord's own fallback still applies to the rest:

```typescript
@CommandBuilder(CommandType.SLASH)
export class BanCommandBuilder implements CommandBuilderBase {
  build() {
    return new SlashCommandBuilder()
      .setName(t.default('ban.name'))
      .setNameLocalizations(t.localizations('ban.name'))
      .setDescription(t.default('ban.description'))
      .setDescriptionLocalizations(t.localizations('ban.description'))
  }
}
```

Interactions still report the default name, so routing is unchanged. Discord limits names to 32 lowercase characters and descriptions to 100: a builder that is handed a longer one fails when its class is decorated, with an error naming the builder and the command, and a raw command body that breaks the rules stops registration with one error listing every field, instead of Discord's opaque rejection.

**Replies.** `t.for(interaction)` translates into the user's language; `{ public: true }` into the server's, for a reply everyone there sees. `t.forGuild(guild)` uses the server's preferred language, for events and messages, which have no user locale. `t.locale('ja')` takes any locale.

```typescript
await interaction.reply(t.for(interaction)('ban.done', { user: target.toString() }))
await channel.send(t.forGuild(member.guild)('warnings', { user: member.displayName, count: 3 }))
```

A locale resolves to its own catalog, then to another of the same language (`es-419` to `es-ES`, `en-GB` to the `en-US` default), then to the default, message by message.

**Params and plurals.** `'Banned {user}.'` requires `{ user }`; a misspelled or missing param fails to compile. A plural is an object whose keys are plural categories — `zero`, `one`, `two`, `few`, `many` and the required `other` — and takes a numeric `count`, which picks the form through `Intl.PluralRules` for the locale, so Russian's `few` and `many` work without extra code. An object whose keys are all category names is always read as a plural. Params take strings and numbers; format numbers and dates yourself, with `Intl.NumberFormat` for instance.

**The default catalog must be TypeScript.** Params are typed from the message text, which TypeScript keeps only for a literal: wrap the catalog in `defineCatalog(...)`, or add `as const`. A catalog that has lost its text types is refused with a compile error saying so. Other locales may be plain objects or JSON: they are checked against the default's keys, and fall back at runtime.

**In services.** Pass the translator to `@MeoCord({ i18n: t })` and inject it as `Translator`, typed by the default catalog; importing `t` works too. A class that injects `Translator` in an app without `i18n` stops the bot at startup with a message saying what to pass.

```typescript
@Service()
export class BanService {
  constructor(private readonly t: Translator<typeof enUS>) {}
}
```

**Testing.** `expectCompleteCatalog(t)` from `meocord/testing` fails with every message a locale lacks, every message the default catalog does not have, and every plural form a language needs but lacks. A testing module created with `app` injects the app's translator; otherwise provide one with `{ provide: Translator, useValue: t }`.

The built-in fallback's own texts — "Command not found!" and the generic error — stay in English. An [exception filter](/docs/4.1/exception-filters#exception-filters) can answer in the user's language instead.

---
