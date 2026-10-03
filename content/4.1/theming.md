---
id: theming
title: Theming
chapter: structure
order: 3
summary: Give every answer your bot sends its colours and emojis by role, set once and changed where you need to.
learn:
  - Set a theme for the app and change it for a controller or a handler
  - Read the theme in handlers, services and presenters
  - Look up a theme per server and per user
  - Add tokens of your own and test a themed bot
requires: [responses, presenters]
api:
  [
    decorators/UseTheme,
    responses/useTheme,
    responses/bindTheme,
    utilities/ThemeCache,
    types/MeoCordTheme,
    configuration/RootTheme,
    configuration/ThemeOverride,
    testing/createMockTheme,
    testing/withTheme,
  ]
since: 4.1.0
---

A theme holds the colours, emojis and button styles your bot's answers use, named by what they mean rather than by
their value. Code asks for `danger`, not for red, so a bot changes its look in one place. MeoCord gives every role a
default, so a theme sets only what it changes.

## When to use it

Use a theme when your answers share a look: a brand colour on every embed, a success emoji on every confirmation, or
a different colour for each server that hosts your bot. Reading a colour from the theme keeps that look in one
place instead of in every handler.

You don't need one to start. With no theme, `respond()` and MeoCord's own views use the defaults, which are tuned to
stay readable on every Discord theme. For a one-off embed whose colour means nothing, set the colour on the embed
itself.

## Example

The app sets its theme, and a controller changes part of it for its own handlers:

::example{file="app-with-theme.ts" region="app"}

::playground{file="controllers/slash/store.slash.controller.ts" region="store" dispatch="/receipt; /refund; /banner"}

`/receipt` reads the theme and builds its embed from the `success` role, with the app's 🎉. `/refund` changes the
primary colour and the loading emoji for that one handler, and its embed, sent with no colour, takes that primary.
`/banner` sends its embed as written, whatever the theme.

## How it works

A theme is resolved for each call before anything runs, and it stays the same for the whole call. Each layer sets
only what it changes, over the one beneath it:

1. MeoCord's defaults;
2. [`@MeoCord({ theme })`](api:decorators/MeoCord#theme), the app's theme;
3. [`@UseTheme`](api:decorators/UseTheme) on each class, from a base class down to the controller;
4. `@UseTheme` on the handler;
5. the server's theme, then the user's, from [`themeFor`](#per-server-and-per-user).

Plain objects merge key by key. Anything else, such as an array of colours, replaces the value beneath it. The
resolved theme is frozen, since it's shared by every call it applies to.

A bot that sets no `@UseTheme` and no `themeFor` builds its theme once, at startup, and each call reads it.

## Tokens

A theme has three groups of roles:

| Group     | Roles                                                        | A value is                                                                               |
| --------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `colors`  | `primary`, `neutral`, `success`, `warning`, `danger`, `info` | a colour discord.js accepts: `'#7680F4'`, `0x7680f4`, `[118, 128, 244]` or a colour name |
| `emojis`  | `loading`, `success`, `warning`, `danger`, `info`            | a unicode emoji, or a custom one written `<:name:id>`, or `<a:name:id>` when animated    |
| `buttons` | `primary`, `neutral`, `success`, `danger`                    | `ButtonStyle.Primary`, `Secondary`, `Success` or `Danger`                                |

`warning` is for what the user can fix, such as a refused or invalid call. `danger` is a fault in the bot. MeoCord
checks every token where it's set; see [Valid tokens](#valid-tokens).

### Defaults

| Role      | Colour    | Emoji | Button style            |
| --------- | --------- | ----- | ----------------------- |
| `primary` | `#7680F4` | —     | `ButtonStyle.Primary`   |
| `neutral` | `#888B95` | —     | `ButtonStyle.Secondary` |
| `success` | `#26A042` | ✅    | `ButtonStyle.Success`   |
| `warning` | `#B08400` | ⚠️    | —                       |
| `danger`  | `#E3606D` | ⛔    | `ButtonStyle.Danger`    |
| `info`    | `#1699AE` | ℹ️    | —                       |
| `loading` | —         | ⏳    | —                       |

The success, warning, danger and info colours keep the hues of 4.0's `Theme`, with their lightness moved until each
gives at least 3:1 against every surface an embed's stripe or a container's accent sits on in Discord's light, dark,
darker and midnight themes: the contrast WCAG 2.1 asks of a graphic that carries meaning. A test in MeoCord holds every
default to it, so a default that changes still reads on light and dark alike.

### Valid tokens

- **A colour** is a 6-digit hex string such as `'#7680F4'`, with or without `#`; a whole number from `0` to
  `0xFFFFFF`; an `[r, g, b]` tuple of whole numbers from 0 to 255; or a discord.js colour name such as `'Blurple'`. A
  3-digit hex string such as `'#FFF'` isn't one.
- **An emoji** is one unicode emoji, flags, keycaps, skin tones and joined sequences such as `'👨‍👩‍👧'` included, or a
  custom one written `<:name:id>` or `<a:name:id>`. A shortcode such as `':smile:'` isn't one. A custom emoji must also
  be one the bot may use, such as an emoji the application owns.
- **A button style** is `ButtonStyle.Primary`, `Secondary`, `Success` or `Danger`.
- **A role MeoCord reserves** is refused in `colors`, `emojis` or `buttons`, in JavaScript as in TypeScript.

Each problem is named with its key path and what to give instead, such as
`theme.colors.primary: '#GGG' is not a colour: give a 6-digit hex string such as '#7680F4', …`. MeoCord's groups are
checked whatever roles an app added to them; a group of the app's own is the app's to check.

A theme set in code is checked where it's declared. A bad token in `@MeoCord({ theme })` or `@UseTheme` stops the bot
before it logs in. The message names where the theme was set, then each token it refuses, as in
`ShopController.refund: @UseTheme: the theme has 1 problem:` followed by `theme.emojis.loading: …`.

## Reading the theme

[`useTheme()`](api:responses/useTheme) returns the theme of the running call, with every role present. It works
anywhere the call runs: in the handler, in a service or a presenter it calls, and in a timer or a promise it starts.
A guard, an interceptor or a filter reads the same theme as `context.getTheme()`.

Outside any call, as in a scheduled job or an `onShutdown` hook, `useTheme()` returns the app's theme from when its
start begins until it has shut down, and MeoCord's defaults before and after.

### Collectors and listeners

A collector's `collect` callback, or a `client.on(...)` listener, is called by its emitter, outside the call that
set it up. `respond(click)` there still takes the app's theme, with the server's and the user's over it, but not the
handler's `@UseTheme`. To keep the handler's, wrap the callback in [`bindTheme`](api:responses/bindTheme):

::playground{file="controllers/slash/vote.slash.controller.ts" region="bind" dispatch="/vote"}

## What respond() themes

An embed with no `color`, and a Components V2 container with no `accent_color`, sent through
[`respond()`](guide:responses), take the theme's `primary`. A colour you set is kept, `0` included. MeoCord's own
views, the loading view and error answers, are styled by the [presenter](guide:presenters), which gets the theme and
the error's tone.

To send one message as written, pass `{ fill: false }` as the second argument to `send()`, `edit()` or
`followUp()`, as `/banner` does above. The next message is filled again. What you send around `respond()`, with
`interaction.reply()`, is never touched.

MeoCord's replies to a message, a usage error, a guard's or validation's reason, and a `UserError`'s message, are plain
text, which a theme leaves as it is unless the [presenter](guide:presenters#message-command-errors) draws them with
`messageError`. With `@MeoCord({ messages: { replyEmoji: true } })` each of them begins with the call's
`emojis.warning`, as do the direct messages of `dmOnError` and `dmOnCooldown`, and the built-in help with its
`emojis.info`: see [Usage errors](guide:message-commands#usage-errors).

## Per server and per user

`themeFor` looks a theme up by where a call comes from: a server's goes over the handler's, and a user's over the
server's, in a server or in a DM.

::example{file="app-with-theme-for.ts" region="app"}

Each resolver returns part of a theme, or `undefined` for none, at once or as a promise. Results are cached for
`themeCache.ttlSeconds`, five minutes by default, and calls that ask at the same time share one lookup. When a server's
theme changes, clear its cached result so the next call looks it up again:

::example{file="controllers/slash/theme-settings.slash.controller.ts" region="invalidate"}

To look a theme up with the app's services, such as a user's choice saved in a database, give `themeFor` a class
implementing [`ThemeResolver`](api:configuration/ThemeResolver), decorated with `@Service()`. Its `guild()` and
`user()` methods are the resolvers, each optional. The class is resolved from the app's container, as the cooldown store
is: it isn't listed in `providers`, its constructor injects the app's services and providers, and it runs `OnReady` and
`OnShutdown` as a service does. Its results are cached as the functions' are, so the service that saves a choice
injects `ThemeCache` and clears it:

::example{file="app-with-theme-resolver.ts" region="resolver"}

A call's theme is looked up once, as the call starts, and holds for the whole call. The call that saves a new choice
still answers in the old palette, and the user's next call gets the new one.

A resolver that throws, or passes `themeForTimeoutMs`, leaves its layer out of that call, and the call goes on. A
result that isn't a valid theme is left out with a warning.

## Adding tokens of your own

Declare roles of your own, or groups of your own, in `src/types/theme.d.ts`, which the `create` command writes for you:

::example{file="augmented/types/theme.d.ts" region="augment"}

Your tokens have no default, so your root theme has to set them, and TypeScript says so if it doesn't. `useTheme()`
then always has them:

::playground{file="augmented/vip.app.ts" region="app" dispatch="/vip"}

A few names are reserved for roles MeoCord may add later, such as `accent` and `brand`. Taking one is a type error at
your root theme, naming each.

## Testing a themed bot

A testing module runs each call in its theme, as the bot does. Give the module a theme with `overrideTheme`, and
compare against [`createMockTheme()`](api:testing/createMockTheme), a whole theme with MeoCord's defaults:

::example{file="controllers/slash/store.slash.controller.spec.ts" region="spec"}

To run a service in a theme without a module, use `withTheme(theme, fn)`. See
[Mocks](guide:mocks) for both.

## From the Theme class

`Theme` from `meocord/common` still works, and it's deprecated. Each of its colours reads the matching role of the
call's theme, and `errorColor` is `danger`. Read the theme with `useTheme()` in new code, and set colours in
`@MeoCord({ theme })`. The
[migration guide](guide:migrating#theme-is-deprecated-and-its-colours-changed)
lists the old values if you want to keep them.

## Gotchas

- **The augmentation file needs its import.** Without `import 'meocord/interface'` at the top, `declare module`
  replaces the module instead of extending it, and every other import from it stops compiling.
- **A theme kept in a variable isn't checked for typos.** TypeScript checks only object literals, so write it with
  `satisfies ThemeOverride`.
- **A theme from a database must be a plain object.** A class instance, such as an ORM row, is refused: return
  `row.toObject()` or `{ ...row }`.
- **A `ThemeResolver` class declares its resolvers as methods.** `user = () => …` is a property of each instance, not
  of the class, so it is not read, and a class with only such properties is refused. Without `@Service()`, a
  constructor that injects is refused too.
- **A `user` resolver runs for every message a message handler takes.** Keep it cheap; its result is cached per
  user.

## Build it

The feedback bot's review posts have no colour, and every verdict takes MeoCord's default primary. Give the bot a
colour of its own:

::example{file="tutorial/app.ts" region="step:theming"}

The review post is sent with `channel.send`, not `respond()`, so it reads the theme itself:

::example{file="tutorial/feedback.controller.ts" region="step:theming"}

Colour each verdict by what it means, and give the review buttons a loading emoji of their own:

::example{file="tutorial/review.controller.ts" region="step:theming"}

Submit a report, then approve one and reject another: the post arrives in the bot's colour, an approval turns it
green and a rejection grey, and 📝 shows while each is saved.

## Next steps

- [Presenters](guide:presenters): style MeoCord's loading and error views from the theme and the error's tone.
- [Answering with respond()](guide:responses): what `respond()` sends, and where the theme fills it.
- [Mocks](guide:mocks): themes, and everything else a test builds.
