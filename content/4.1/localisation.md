---
id: localisation
title: Localisation
section: Answering Discord
order: 24
since: 4.1.0
---

One catalog of messages per language serves both what Discord shows for your commands, their names and
descriptions, and what your bot replies. The other catalogs are typed from the default one: a key the default
does not have, or a message of the wrong shape, such as a plain text where the default has a plural, fails to
compile. A key a catalog leaves out is looked up in another catalog of the same language, then the default
one, and [`expectCompleteCatalog`](#testing) reports it in a test, as it does a plural form a language needs but
a catalog lacks. Nothing is added to your dependencies.

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

## MeoCord's own texts

What MeoCord itself tells users goes through the same translator: a message command's usage and what is wrong
with it, the built-in `!help`, cooldown refusals, "Command not found!", the generic error, and the default
presenter's "Working on it…" and "Oops!". Add a `meocord` group to any catalog, all of it or part:

::example{file="locales/id.ts" region="meocord"}

Each text is looked up on its own, so a line a language leaves out stays in MeoCord's English, even inside a
reply whose other lines are translated. The keys and their English are in
[`MeoCordMessages`](/docs/4.1/api/interface/MeoCordMessages): a key MeoCord lacks, or a `{param}` its English
text lacks, does not compile, and the error names the text and the params it takes. Without `i18n`, every
text is the English one.

Answers to an interaction are in the user's language; replies to a message, and `!help`, in the server's
preferred language, or the default locale's in a direct message. MeoCord's English stands as the English
catalog: an English-speaking server or user gets it even when the default locale is another language, unless
your own `en-US` or `en-GB` catalog words the text. Lists, such as a param's choices, are joined in the words
of the language whose catalog has the text, as in "asc, desc, atau random".

::example{file="i18n-texts/paint.controller.spec.ts" region="usage"}

**Labels of your own param types.** A type's `label` is one wording. Give it a `labelKey` instead, a message
of your catalog, and register it in an app with `i18n`; `@MeoCord` refuses a `labelKey` without `i18n`, or
one the default catalog has no message for:

::example{file="i18n-texts/color.ts" region="type"}

::example{file="i18n-texts/app.ts" region="app"}

**In an exception filter.** A filter that answers one of MeoCord's errors its own way can keep MeoCord's
words: [`translateError(error, t, target)`](/docs/4.1/api/common/translateError) returns the text the fallback
would send, in the language of an interaction, a message, or a locale. A guard's or a `UserError`'s message is
yours and comes back as it is.

::example{file="i18n-texts/cooldown.filter.ts" region="filter"}

**Testing.** `expectCompleteCatalog(t)` leaves MeoCord's texts to their English fallback, and reports only a
`meocord` key MeoCord lacks. `expectCompleteCatalog(t, { meocord: true })` requires every language other than
English to translate each of them:

::example{file="i18n-texts/paint.controller.spec.ts" region="complete"}
