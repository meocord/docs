---
id: mocks
title: Mocks
section: Testing
order: 42
---

`createMockInteraction(Class, overrides?)` mocks any discord.js class, interactions and everything else. It
keeps the class's prototype chain, so `instanceof` holds at every level, and a mock can be passed straight to
code that expects the real class.

::example{file="testing/mocks.spec.ts" region="interaction"}

- **Type guards** such as `isButton()`, `isRepliable()` and `isChatInputCommand()` run discord.js's own logic,
  from the class the mock was made from. They are still mock functions, so a test can override one.
- **Replies** follow Discord's rules: replying or deferring twice throws, and `followUp()`, `editReply()` and
  `deleteReply()` throw before any reply. An autocomplete interaction's `respond()` works once.
- **Every method** is a mock function, with `.mock.calls`, which both Vitest's and Jest's matchers read.
- **Locales** are set as Discord sends them: `locale` is `'en-US'`, and `guildLocale` is `'en-US'` with a
  `guildId` and `null` without, so a [translator](/docs/4.1/localisation) works on a default mock. Pass
  either to change it.

::example{file="testing/mock-defaults.spec.ts" region="locales"}

## Overrides

The second argument sets properties as the mock is built. It is the only way to set what discord.js makes
read-only, such as a modal's `customId` and `fields`, a component's `message`, or a context menu's
`targetUser`. A misspelled property name is a compile error.

`inGuild()`, `inCachedGuild()` and `inRawGuild()` answer from the `guildId` and `guild` a mock is given, as
discord.js does: a `guildId` is a server, a `guildId` with a `guild` a cached one, and a mock with neither is a
direct message, where all three are `false`.

To put a command somewhere a user-installed app can be used, set `context` and
`authorizingIntegrationOwners`:

::example{file="controllers/slash/stats.slash.controller.spec.ts" region="contexts"}

## Options

`createChatInputOptions(record)` builds a command's options, found by name as the real resolver finds them:

::example{file="testing/mocks.spec.ts" region="options"}

User, role, channel and attachment options are set both as the id and as the resolved object, so a handler
reading only one of the two is caught. For autocomplete, `focused` names the option being typed.
`subcommandGroup`, `subcommand` and `focused` are reserved names. A modal's submitted fields come from
`createModalFields({ body: 'It crashed' })`.

## Messages, users and the rest

- `createMockMessage()` mocks a message that tracks whether it was deleted: `delete()`, `edit()`, `reply()`
  and the rest throw once it is, and `edit()` and `reply()` resolve to a new mock message. It takes an
  `id`, `content`, `components`, `embeds` and `flags`; components and embeds may be Discord's JSON, builders
  or discord.js objects.
- `createMockUser()`, `createMockClient()`, `createMockGuild()` and `createMockChannel(Class)` mock the
  classes a handler reads most, with their managers stubbed.
- `createMock<Interface>()` mocks a type with no class at runtime, such as a service's interface.

## What methods return

A method that returns a promise in discord.js resolves, so `await` and `.catch()` work with no setup:

| Method                                                          | Resolves to                                                 |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| `send()`, `reply()`, `crosspost()`, `forward()`, `fetchReply()` | a mock message                                              |
| a manager's `fetch(id)`, or `fetch({ user })` and the like      | a mock of its item: a user, member, guild, role, message, … |
| a manager's `fetch()` for a list                                | an empty `Collection`                                       |
| a manager's `create()` and `edit()`                             | a mock of its item                                          |
| `createDM()`                                                    | a mock DM channel                                           |
| a structure's own `edit()`, `fetch()`, `delete()` and setters   | the structure itself                                        |
| any other method that returns a promise                         | `undefined`                                                 |

::example{file="testing/mock-defaults.spec.ts" region="promises"}

Methods that return a value at once, such as `avatarURL()`, return `undefined`. A test still decides with
`mockResolvedValue`, `mockRejectedValue` and the rest.

## Resetting between tests

Vitest's `clearMocks` and `restoreMocks` reach only `vi.fn()`, so `meocord/testing` has its own:
`clearAllMocks()` forgets what every mock it made has recorded, and `resetAllMocks()` also undoes what a
test told them, back to how each was created. Mocks inside `createMockInteraction`, `createMockClient` and
the rest are covered, and keep their own rules, such as refusing a second reply.

::example{file="testing/reset.spec.ts" region="reset"}

New projects reset after every test from `vitest.setup.ts`:

::example{file="config/vitest.setup.ts" region="setup"}

So set what a mock returns in the test that relies on it, or in `beforeEach`, rather than once for a whole
`describe`. An older project gets the same by adding that file and `setupFiles: ['./vitest.setup.ts']` to its
`vitest.config.ts`.

## Discord's errors

`createDiscordError(code)` builds the `DiscordAPIError` discord.js throws, for a mock to reject with: 10062
when the three seconds to answer passed, 40060 when the interaction was already acknowledged, 50001 for
missing access, and 50027 when the fifteen-minute token has expired.

::example{file="testing/mocks.spec.ts" region="errors"}
