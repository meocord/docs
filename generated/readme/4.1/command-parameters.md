---
id: command-parameters
title: 'Command Parameters'
order: 8
source: readme@4.1.0-beta.0
---

Buttons, select menus and modals route on their `customId`, and a pattern can capture parts of it. Captured values arrive as the handler's second argument. A modal handler's second argument also carries the submitted fields, keyed by their customId: a text input's text, a select's chosen values. When a field and a captured value share a name, the captured value wins, and development logs a warning.

```typescript
@Command('profile/{ownerId}/{uid}', CommandType.BUTTON)
async showProfile(interaction: ButtonInteraction, { ownerId, uid }) {
  // customId `profile/123/800000001` gives ownerId '123', uid '800000001'
}
```

`/` separates segments, and **a parameter must occupy a whole segment** — the same rule Express and Rails use for a path. A pattern that breaks it throws as soon as `@Command` decorates the method, when the controller is loaded:

```typescript
@Command('profile/{uuid}', CommandType.BUTTON)      // fine
@Command('gi-profile/{ownerId}', CommandType.BUTTON) // fine — the hyphen is inside a literal segment
@Command('profile-{uuid}', CommandType.BUTTON)       // throws
```

```
Invalid pattern "profile-{uuid}": {uuid} must occupy a whole segment, so it has to be
preceded and followed by "/" or by the ends of the pattern. Write "a/{uuid}" rather
than "a-{uuid}".
```

<details>
<summary><b>Why the rule exists</b></summary>

A parameter matches anything up to the next `/`, so an identifier you do not control is captured whole — a hyphen inside a uuid is data, not structure:

```typescript
@Command('profile/{uuid}', CommandType.BUTTON)
// `profile/8400e29b-41d4-a716`  ->  uuid '8400e29b-41d4-a716'
```

That only works because the separator cannot appear inside a value. Let a parameter share a segment with a literal and the boundary disappears: `profile-{uuid}` and `profile-{uuid}-{id}` both match `profile-a-b-c`, and neither reading is more correct than the other. No rule can settle that afterwards, so the shape is refused up front.

Segment counts then keep neighbours apart on their own:

```typescript
@Command('profile/{uuid}', CommandType.BUTTON)        // profile/8400e29b-41d4-a716
@Command('profile/{uuid}/{id}', CommandType.BUTTON)   // profile/8400e29b-41d4-a716/99
```

Each id matches exactly one of them.

</details>

<details>
<summary><b>Overlapping patterns</b></summary>

Two patterns with the same segment count can still both match. The one spelling out more literal text wins, so declaration order and file layout never decide it:

```typescript
@Command('profile/summary/{ownerId}/{uid}', CommandType.BUTTON)  // wins profile/summary/123/456
@Command('profile/{uuid}/{other}/{uid}', CommandType.BUTTON)     // wins everything else
```

Ties between equally literal patterns go to the one with fewer parameters. The ranking is computed once when the bot starts, so dispatch stays a single ordered lookup.

Where two patterns trade a literal for a parameter in opposite positions — `a/{x}/c` and `a/b/{y}` both take `a/b/c` — neither is more literal, and MeoCord logs a warning at startup naming the pair.

</details>

<details>
<summary><b>When nothing matches</b></summary>

An unroutable interaction raises `CommandNotFoundError`, which the [built-in fallback](/docs/4.1/exception-filters#the-built-in-fallback) answers with "Command not found!", and logs a warning naming the `customId` or command that failed to match. If a control appears dead, that log line is the first place to look.

Autocomplete cannot be replied to, so an unclaimed option is answered with an empty list instead and the warning names the command and option.

A handler that throws goes to its [exception filters](/docs/4.1/exception-filters#exception-filters), then to the built-in fallback, which logs the error and answers the user in whatever way the interaction still allows — editing a deferred reply, or following up one already sent.

</details>

<details>
<summary><b>Failures never take the bot down</b></summary>

discord.js calls event listeners without awaiting them, so anything that rejects out of one is an unhandled rejection — which terminates the process by default. MeoCord wraps every listener it registers, so one bad interaction, one unresolvable controller, or one reaction on a deleted message costs that event and nothing else. The error is logged against the event that produced it, so a genuine misconfiguration still shows up on the first interaction rather than staying hidden.

Where the failure happened before the handler ran, the user is still told: an interaction gets the fallback's answer, an autocomplete gets its window closed. A reaction whose message can no longer be fetched — deleted, or in a channel the bot lost access to — is skipped quietly, since that is an ordinary outcome rather than a fault.

</details>

---
