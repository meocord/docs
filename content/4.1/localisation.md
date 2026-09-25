---
id: localisation
title: Localisation
section: Answering Discord
order: 24
since: 4.1.0
---

One catalog of messages per language serves both what Discord shows for your commands, their names and
descriptions, and what your bot replies. The other catalogs are typed from the default one, so a missing key,
a misspelled parameter or a plural form a language needs is caught at compile time. Nothing is added to your
dependencies.

## Catalogs

The default catalog must be TypeScript, wrapped in `defineCatalog(...)` or written `as const`, since the
parameters are typed from the message text:

::example{file="locales/en-US.ts" region="catalog"}

Other languages may be plain objects, or JSON. A message they leave out falls back:

::example{file="locales/id.ts" region="catalog"}

Create the translator at module scope, since command builders run when their class is decorated:

::example{file="i18n.ts" region="translator"}

Locales are discord.js `Locale` values, such as `en-GB`, `es-419` or `zh-TW`; a bare `en` is refused. A
locale resolves to its own catalog, then to another of the same language (`es-419` to `es-ES`, `en-GB` to
`en-US`), then to the default, message by message.

## Commands

A builder uses the translator directly. `t.localizations(key)` returns only the locales whose catalog has
the message, so Discord's own fallback still applies to the rest:

::example{file="controllers/slash/builders/warn.builder.ts" region="builder"}

Interactions still report the default name, so routing does not change. Discord limits names to 32 lowercase
characters and descriptions to 100: a builder handed a longer one fails when its class is decorated, naming
the builder and the command.

## Replies

`t.for(interaction)` translates into the language of the user who ran the command; `{ public: true }` into the
server's, for a reply everyone there sees. `t.forGuild(guild)` uses the server's preferred language, for
events and messages, which have no user language. `t.locale(locale)` takes any locale.

::example{file="controllers/slash/warn.slash.controller.ts" region="reply"}

## Parameters and plurals

`'Warned {user}.'` requires `{ user }`: a missing or misspelled parameter does not compile. A plural is an
object whose keys are plural categories, `zero`, `one`, `two`, `few`, `many` and the required `other`, and
takes a numeric `count`, which picks the form through `Intl.PluralRules` for the language. Parameters take
strings and numbers; format numbers and dates yourself, with `Intl.NumberFormat` for instance.

## In services

Pass the translator to `@MeoCord({ i18n: t })` and inject it as `Translator`, typed by the default catalog;
importing `t` works too. A class that injects `Translator` in an app without `i18n` stops the bot at startup,
with a message saying what to pass.

## Testing

`expectCompleteCatalog(t)` from `meocord/testing` fails with every message a language lacks, every message
the default catalog does not have, and every plural form a language needs but lacks:

::example{file="controllers/slash/warn.slash.controller.spec.ts"}

The built-in fallback's own texts, "Command not found!" and its generic error, stay in English. An exception
filter can answer in the user's language instead.
