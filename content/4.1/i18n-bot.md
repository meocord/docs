---
id: i18n-bot
title: A bot in two languages
chapter: appendix
group: recipes
order: 6
summary: An /announce command in English and Indonesian, with MeoCord's own answers in the member's language too.
requires: [localisation, slash-commands, gateway-events, cooldowns]
api: [decorators/MeoCord, decorators/Cooldown, decorators/On, types/MeoCordMessages, utilities/translateError]
since: 4.1.0
formerly: [recipe-i18n-bot]
---

`/announce` in English and Indonesian. Members see the command in their own language, the announcement is posted in
the server's language for everyone, and the author's confirmation is in theirs. New members are welcomed in the
server's language, and what MeoCord answers itself, such as a cooldown notice, comes in the member's. It uses
[Localisation](guide:localisation) end to end.

## The code

The default catalog is typed, and the Indonesian one only has to cover what it translates:

::example{file="recipes/i18n/bot.ts" region="catalog"}

Beside the bot's own messages, the Indonesian catalog translates MeoCord's texts, in a `meocord` group:

::example{file="recipes/i18n/bot.ts" region="catalog-meocord"}

::example{file="recipes/i18n/bot.ts" region="translator"}

`t.localizations` gives Discord the command's name and descriptions in every language that has them, and Discord
shows each member theirs:

::example{file="recipes/i18n/bot.ts" region="builder"}

The handler picks whose language each message is in:

::example{file="recipes/i18n/bot.ts" region="controller"}

The app gives MeoCord the translator, which is what makes its own texts follow the catalogs:

::example{file="recipes/i18n/bot.ts" region="app"}

## How it works

- **Whose language.** A message everyone sees follows the server, `t.for(interaction, { public: true })`. A private
  one follows the user, `t.for(interaction)`. An event has no user, so the welcome follows the server, with
  `t.forGuild(guild)`. See [Choosing the language](guide:localisation#choosing-the-language).
- **One route.** Discord reports a command by its default name whatever language the member sees, so the route is
  `announce` in every language.
- **MeoCord's own texts.** With `@MeoCord({ i18n: t })`, what MeoCord answers itself goes through the same translator:
  cooldown refusals, "Command not found!", the generic error, and the presenter's "Working on it…" and "Oops!". Answers
  to an interaction are in the user's language. A second announcement within the minute is refused in the author's
  language, such as "Pelan-pelan: coba lagi {when}." under the title "Ups!", where `{when}` is a Discord timestamp each
  member's app shows in their own language and counts down.
- **Checked when it compiles.** The keys of the `meocord` group and their `{params}` are those of
  [`MeoCordMessages`](api:types/MeoCordMessages), so a misspelt key or a param MeoCord doesn't pass fails to
  compile.
- **What a language leaves out.** Each text is looked up on its own, so a line the Indonesian catalog left out would
  stay in MeoCord's English. This catalog translates all of them.

### Testing it

A mock's `locale` and `guildLocale` stand for the member's and the server's languages. The cooldown test runs the
command twice through the app, as the bot does, and reads the refusal the author sees.
`expectCompleteCatalog(t, { meocord: true })` fails when a language lacks a message, MeoCord's own included, or uses a
`{param}` the default message doesn't take:

::example{file="recipes/i18n/bot.spec.ts" region="spec"}

## Variations

### A server's own choice

Keep a language for each server in a service or [a database](guide:recipes/database), set by a command for admins,
and translate with `t.locale(chosen)`.

### Some of MeoCord's texts

A catalog can translate only some of MeoCord's texts, such as the cooldown notices: the rest stay in MeoCord's
English, line by line. Check it with `expectCompleteCatalog(t)`, without `{ meocord: true }`: it still reports a
`{param}` MeoCord's English doesn't take.

### MeoCord's words in your own answer

An [exception filter](guide:exception-filters) that answers a cooldown its own way can keep MeoCord's translated
words with [`translateError`](api:utilities/translateError). See
[MeoCord's own texts](guide:localisation#meocords-own-texts).

## Next steps

- [Localisation](guide:localisation): catalogs, plurals, and choosing the language.
- [Presenters](guide:presenters): a loading view and error titles in the user's language.
- [Gateway events](guide:gateway-events): the welcome's `@On('guildMemberAdd')`.
