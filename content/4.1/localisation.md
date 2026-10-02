---
id: localisation
title: Localisation
chapter: structure
order: 4
summary: Answer each user in their language, and name your commands in theirs, from typed catalogs checked at compile time.
learn:
  - Write a catalog per language, typed from the default one
  - Localise command names and descriptions, and every reply
  - Pick the user's language, the server's, or any other
  - Check that every language is complete, in a test
requires: [slash-commands, services]
api:
  [
    utilities/createTranslator,
    utilities/defineCatalog,
    utilities/Translator,
    testing/expectCompleteCatalog,
    utilities/translateError,
    types/MeoCordMessages,
    decorators/MeoCord,
  ]
since: 4.1.0
---

A translator turns a message key into text in a language. Its messages come from catalogs, one per language, and one
set of catalogs serves both what Discord shows for your commands and what your bot says. The other catalogs are typed
from the default one: a key the default doesn't have, a `{param}` its message doesn't take, or a message of the
wrong shape, such as a plain text where the default has a plural, fails to compile. A key a catalog leaves out is
looked up in another catalog of the same language, then the default one, and
[`expectCompleteCatalog`](#testing-a-catalog) reports it in a test, as it does a plural form a language needs but a
catalog lacks.

## When to use it

Localise as soon as your bot serves people in more than one language, or will: Discord tells the bot each user's
language on every interaction, and each server's preferred one. MeoCord's translator adds nothing to your
dependencies.

A bot that only ever speaks one language doesn't need it. Keeping its texts in one catalog still makes them easy to
find, and a second language is a new file later.

## Example

The default catalog, which every other language is checked against:

::example{file="locales/en-US.ts" region="catalog"}

Another language gives what it translates. What it leaves out falls back to the default:

::example{file="locales/id.ts" region="catalog"}

The translator, made from both:

::example{file="i18n.ts" region="translator"}

A command named and answered in the user's language:

::example{file="controllers/slash/builders/warn.builder.ts" region="builder"}

::example{file="controllers/slash/warn.slash.controller.ts" region="reply"}

A user whose Discord is in Indonesian sees `/peringatan`, and gets "ada diberi peringatan." when they warn ada.

## How it works

`createTranslator` checks its locales when its module loads: each must be a Discord locale, and the default must have
a catalog. A translate function, such as `t.for(interaction)`, then looks up each message, fills its parameters and
returns a string.

A locale resolves message by message:

1. its own catalog;
2. another of the same language: `es-419` to `es-ES`, `en-GB` to `en-US`;
3. the default catalog.

Locales are discord.js `Locale` values, such as `en-GB`, `es-419` or `zh-TW`. A bare `en` is refused, naming it.

A key no catalog has a message for, or one that names a group of messages, comes back as the key itself, rather than
throwing. In development, the translator logs a warning naming it, once for each key.

Command names are read when a controller's `@Command` builds its builder, as the controller's module loads, which is why
the translator is made at module scope. An interaction still reports the command's default name, so
`@Command('warn', ...)` routes `/peringatan` too.

## Choosing the language

| Call                                   | Language                                                              |
| -------------------------------------- | --------------------------------------------------------------------- |
| `t.for(interaction)`                   | The user's, for an answer they read.                                  |
| `t.for(interaction, { public: true })` | The server's, for a message everyone there reads; the user's in a DM. |
| `t.forGuild(guild)`                    | The server's, for events and messages, which have no user language.   |
| `t.locale(locale)`                     | Any locale, such as one you stored with the user.                     |
| `t.default(key)`                       | The default catalog.                                                  |
| `t.localizations(key)`                 | Every translation of a message, for a command builder.                |

`t.localizations(key)` returns only the locales whose catalog has the message, so Discord's own fallback applies to the
rest. Discord shows a name or a description as written, so it takes only a message without parameters: a key whose
message takes one doesn't compile, or, in a catalog TypeScript can't read, throws as the app loads. A translation that
uses a parameter is left out, and [`expectCompleteCatalog`](#testing-a-catalog) reports it. A helper of your own that
passes a key on to `t.localizations()` types it as [`LocalizationKey<typeof catalog>`](api:types/LocalizationKey), from
`meocord/common`.

A [presenter](guide:presenters) gets the user's locale as `context.locale`, for a loading view and error titles in
their language.

## Parameters and plurals

`'Warned {user}.'` takes `{ user }`, and a missing or misspelt parameter doesn't compile. Parameters take strings
and numbers; format numbers and dates yourself, with `Intl.NumberFormat` for instance.

A plural is an object whose keys are plural categories, `zero`, `one`, `two`, `few`, `many` and the required
`other`. It takes a numeric `count`, which picks the form through `Intl.PluralRules` for the language, so Russian's
`few` and `many` need no code of your own.

A parameter's name is ASCII letters, digits or `_`, such as `{user}` or `{user_id2}`, and a message may take hundreds.
Other text in braces is the message's own: `'Wrap text in { and }.'` takes no parameters. A brace written twice is
one brace of text, so `'Buttons use ticket/{{id}}'` shows `ticket/{id}` and takes no parameter, and `'{{{user}}}'`
shows the `user` parameter in braces.

### Parameters in other languages

A translation may use any of its default message's parameters, in any order, and leave some out, since a language
can say something without the name. A plural's forms may also use `{count}`. A parameter the default message doesn't
take, such as a misspelt or translated name, would reach the user as written, so it's refused twice:

- **When the code compiles,** for a catalog whose text TypeScript keeps: one made with `defineCatalog`, written
  `as const`, or written inline. The error names each parameter, the message and its default text:

  ```text
  id: warn.done takes no {pengguna}; the default is "Warned {user}."
  ```

- **In a test,** [`expectCompleteCatalog`](#testing-a-catalog) reads the catalogs' own strings, so it also checks a
  catalog TypeScript types as `string`: a plain object, such as the Indonesian one above, or a JSON file.

## In services

Pass the translator to the app, and a class injects it as `Translator`, typed by the default catalog:

::example{file="services/moderation/warnings.service.ts" region="service"}

Importing `t` works too. Injecting it keeps a test free to provide another:

::example{file="services/moderation/warnings.service.spec.ts" region="spec"}

## MeoCord's own texts

What MeoCord itself tells users goes through the same translator: a message command's usage and what is wrong with
it, the built-in `!help`, cooldown refusals, "Command not found!", the generic error, the direct messages
[`dmOnError` and `dmOnCooldown`](guide:message-commands#telling-the-author-privately) send, and the default
presenter's "Working on it…" and "Oops!". Add a `meocord` group to any catalog, all of it or part:

::example{file="locales/id.ts" region="meocord"}

Each text is looked up on its own, so a line a language leaves out stays in MeoCord's English. The keys and their
English are in [`MeoCordMessages`](api:types/MeoCordMessages): a key MeoCord lacks does not compile, nor, in a catalog
TypeScript keeps the text of, a `{param}` its English text lacks, and the error names the text and the params it takes.
[`expectCompleteCatalog`](#testing-a-catalog) checks the params of any catalog.

Answers to an interaction are in the user's language; replies to a message, the direct messages about it, and
`!help`, in the server's preferred language, or the default locale's in a direct message. MeoCord's English stands
as the English catalog: an English server or user gets it even when the default locale is another language, unless
your own `en-US` or `en-GB` catalog words the text.

::example{file="i18n-texts/paint.controller.spec.ts" region="usage"}

A type of your own is named in usage replies by its `label`. Give it a `labelKey` instead, a message of your catalog,
for a name in each server's language:

::example{file="i18n-texts/color.ts" region="type"}

An [exception filter](guide:exception-filters) that answers MeoCord's errors its own way can keep their words:
[`translateError(error, t, target)`](api:utilities/translateError) returns the text the fallback would send, in the
language of an interaction, a message or a locale.

::example{file="i18n-texts/cooldown.filter.ts" region="filter"}

## Testing a catalog

`expectCompleteCatalog(t)` from `meocord/testing` fails with every message a language lacks, every message the
default catalog doesn't have, every plural form a language needs but lacks, and every
[parameter the default message doesn't take](#parameters-in-other-languages):

::example{file="controllers/slash/warn.slash.controller.spec.ts" region="complete"}

It lists each gap, language by language:

```text
The catalogs are incomplete:
  id: warn.done takes no {pengguna}; the default is "Warned {user}."
```

MeoCord's own texts fall back to English by design, so it reports only a `meocord` key MeoCord lacks, and a
parameter MeoCord's English doesn't take:

```text
id: meocord.usage.heading takes no {command}: MeoCord's English is "Usage: {usage}"
```

`expectCompleteCatalog(t, { meocord: true })` requires every language other than English to translate each of them:

::example{file="i18n-texts/paint.controller.spec.ts" region="complete"}

## Gotchas

- **The default catalog must be TypeScript,** wrapped in `defineCatalog(...)` or written `as const`. Parameters are
  typed from the message text, which TypeScript keeps only for a literal; a catalog that has lost it is refused
  with a compile error saying so. Other languages may be plain objects, or JSON; their parameters are then checked
  only by [`expectCompleteCatalog`](#testing-a-catalog).
- **Discord limits command names to 32 lowercase characters, and descriptions to 100.** A builder handed a longer one
  fails when the handler's `@Command` builds it, naming the handler, the builder and the command. A raw command body
  whose localised names or descriptions break them is caught at registration instead: nothing is registered, the error
  lists each field, and the bot stays up.
- **Injecting `Translator` needs [`@MeoCord({ i18n })`](api:decorators/MeoCord#i18n).** Without it, the bot stops at
  startup with a message saying what to pass.
- **`labelKey` needs `@MeoCord({ i18n })`, and a message in the default catalog.** `@MeoCord` refuses one
  without either, where the app is declared.

## Build it

The feedback bot speaks English only, with each text written where it's used. Put them in catalogs, one per
language:

::example{file="tutorial/locales/en-US.ts" region="catalog"}

::example{file="tutorial/locales/id.ts" region="catalog"}

::example{file="tutorial/i18n.ts" region="translator"}

Name the command in each language:

::example{file="tutorial/feedback.builder.ts" region="step:localisation"}

Replace each text with its message. The form and the thanks are in the member's language. The review post is in the
server's, since the whole staff reads it:

::example{file="tutorial/feedback.controller.ts" region="step:localisation"}

The verdict posted in the channel is in the server's language, and the author hears back in the language they wrote
in:

::example{file="tutorial/review.controller.ts" region="step:localisation"}

The presenter's loading view and error title follow the member:

::example{file="tutorial/feedback.presenter.ts" region="step:localisation"}

Check every language is complete:

::example{file="tutorial/i18n.spec.ts" region="spec"}

Switch your Discord to Bahasa Indonesia and run `/masukan`: the form and the thanks are in Indonesian, and the review
post is in the server's language. Approve a report, and the loading view is in your language too.

## Next steps

- [Presenters](guide:presenters): answer MeoCord's own loading and error views in the user's language.
- [Exception filters](guide:exception-filters): word an error in the user's language.
- [Mocks](guide:mocks): give a mock interaction a locale, to test each language's answer.
