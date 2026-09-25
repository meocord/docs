---
id: recipe-i18n-bot
title: A bot in two languages
section: Recipes
order: 75
since: 4.1.0
---

`/announce` in English and Indonesian: members see the command in their own language, the announcement is
posted in the server's language for everyone, the author's confirmation is in theirs, and new members are
welcomed in the server's. It uses [Localisation](/docs/4.1/localisation) end to end.

## The catalogs

The default catalog is typed; the other only has to cover what it translates:

::example{file="recipes/i18n/en-US.ts" region="catalog"}

::example{file="recipes/i18n/id.ts" region="catalog"}

## The command in each language

`t.localizations` gives Discord the name and descriptions in every language that has them, and Discord
shows each member theirs:

::example{file="recipes/i18n/announce.builder.ts" region="builder"}

## Whose language

A reply everyone sees follows the server, `t.for(interaction, { public: true })`; a private one follows the
user, `t.for(interaction)`. An event has no user, so a welcome follows the server, with `t.forGuild`:

::example{file="recipes/i18n/announce.controller.ts" region="controller"}

## Testing it

A mock's `locale` and `guildLocale` stand for the member's and the server's languages, and
`expectCompleteCatalog` fails when a language lacks a message:

::example{file="recipes/i18n/announce.controller.spec.ts" region="spec"}

## Going further

- **A server's own choice.** Keep a language per server in a service or a database, set by a command for
  admins, and translate with `t.locale(chosen)`.
- **MeoCord's own answers.** Errors and cooldown notices come from the
  [presenter](/docs/4.1/presenters) and the fallback; an exception filter can answer them in the user's
  language instead.
