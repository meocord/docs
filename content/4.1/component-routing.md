---
id: command-parameters
title: Routing components
section: Core
order: 13
---

Buttons, select menus and modals route on their `customId`, and a `@Command` pattern can capture parts of
it. The captured values arrive as the handler's second argument:

::example{file="controllers/button/profile.button.controller.ts" region="params"}

## Segments

`/` separates a pattern's segments, and **a parameter must fill a whole segment**, the same rule Express
uses for a path. `profile/{uuid}` and `gi-profile/{ownerId}` are fine, since the hyphen in the second is
inside a literal segment. `profile-{uuid}` throws as soon as `@Command` decorates the method:

```text
Invalid pattern "profile-{uuid}": {uuid} must occupy a whole segment, so it has to be
preceded and followed by "/" or by the ends of the pattern. Write "a/{uuid}" rather
than "a-{uuid}".
```

A parameter matches everything up to the next `/`, so an id you do not control, a uuid with hyphens say,
is captured whole. Shared with a literal, the boundary would be ambiguous: `profile-{uuid}` and
`profile-{uuid}-{id}` would both match `profile-a-b-c`, with no right answer.

## Modal fields

A modal handler's second argument also carries the submitted fields, keyed by their `customId`: a text
input's text, a select's chosen values. When a field and a captured value share a name, the captured
value wins, and development logs a warning.

::example{file="controllers/modal-submit/feedback.modal.controller.ts" region="modal"}

## Overlapping patterns

Patterns with different segment counts never compete. When two with the same count both match, the one
spelling out more literal text wins, whatever order they were declared in:

::example{file="controllers/button/profile.button.controller.ts" region="overlap"}

Between equally literal patterns, the one with fewer parameters wins. The ranking is computed once, when the
bot starts. Two patterns that trade a literal for a parameter in opposite places, `a/{x}/c` and `a/b/{y}`,
both take `a/b/c` with neither more literal, and MeoCord warns about the pair at startup.

`resolveRoute` from `meocord/testing` answers which handler an id reaches, in a plain unit test:

::example{file="controllers/button/profile.button.controller.spec.ts"}

## When nothing matches

An interaction no handler matches raises `CommandNotFoundError`, which the built-in fallback answers with
"Command not found!", and MeoCord logs a warning naming the `customId`. When a button seems dead, that log
line is the first place to look.
