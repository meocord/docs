---
id: presenters
title: Presenters
section: Answering Discord
order: 23
since: 4.1.0
---

A presenter decides how MeoCord's own answers look: the error view, and the loading view `@Defer` adds while
a handler runs. What those answers say is decided elsewhere, by exception filters and the built-in fallback.

A presenter returns `{ text, title?, color?, emoji?, components? }` for each view. MeoCord renders it as an
embed, or as a Components V2 container on a message that uses Components V2.

::example{file="presenters/brand.presenter.ts" region="presenter"}

Register it on the app. It is resolved once, from the container, so it can inject services, a `Translator`
to answer in the user's language, for instance:

::example{file="app-with-presenter.ts" region="app"}

Without a presenter, errors are titled "Oops!" in `Theme.errorColor`, and the loading view is
"⏳ Working on it…" in `Theme.primaryColor`.

A presenter is plain code, so its test needs no module:

::example{file="presenters/brand.presenter.spec.ts"}
