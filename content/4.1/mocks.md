---
id: mocks
title: Mocks
chapter: testing
order: 3
summary: Stand in for discord.js interactions, messages, users and Discord's errors, with the rules discord.js follows.
learn:
  - Mock any discord.js class, with the properties a test needs
  - Build a command's options, a modal's fields and a message with its mentions
  - Give a member roles, and read its permissions as discord.js computes them
  - Reset mocks between tests, and reject with Discord's own errors
requires: [testing]
api:
  [
    testing/createMockInteraction,
    testing/createChatInputOptions,
    testing/createMockMessage,
    testing/createMockGuild,
    testing/createMockMember,
    testing/createMockChannel,
    testing/createMockClient,
    testing/createDiscordError,
    testing/resetAllMocks,
  ]
since: 4.0.0
---

A handler takes discord.js objects: an interaction, a message, a reaction, the user behind them. `meocord/testing`
mocks every one of them. A mock keeps its class's prototype chain, so `instanceof` holds at every level and a mock can
go straight to code that expects the real class.

Every method is a mock function, with `.mock.calls`, which both Vitest's and Jest's matchers read.

## When to use it

Use these mocks for the inputs a [testing module](guide:testing) runs, and for services that read discord.js
objects. They follow discord.js's rules, so a handler that replies twice, or reads a server outside one, fails in the
test as it would in the bot.

For a value you own, such as a service's settings, pass a plain object or use
[`overrideProvider`](guide:testing#swapping-a-dependency) instead. A mock is for what Discord sends.

## Example

::example{file="testing/mocks.spec.ts" region="interaction"}

[`createMockInteraction(Class, overrides?)`](api:testing/createMockInteraction) mocks the class you pass, here a
slash command. Its type guards and its replies behave as discord.js's do, and each call is recorded.

## How it works

A mock is built from the class's prototype, with its methods replaced by mock functions:

- **Type guards run discord.js's logic.** `isButton()`, `isRepliable()`, `isChatInputCommand()` and the rest answer
  from the class the mock was made from. They're still mock functions, so a test can override one.
- **Replies follow Discord's rules.** Replying or deferring twice throws, and `followUp()`, `editReply()` and
  `deleteReply()` throw before any reply. After a command shows a modal, `editReply()`, `fetchReply()` and
  `deleteReply()` reject with Unknown Message (10008), since there's no reply. An autocomplete's `respond()` works
  once, and refuses more than 25 choices.
- **Ids are Discord's shape.** An interaction gets an `id`, a `channelId` and a `user`, a person rather than a bot,
  each a snowflake no other mock in the run has. Two mocks are two users, so a per-user cooldown counts them apart;
  give them one `user`, or one message `author`, to count them together. Ids you give are kept.
- **Creation times come from the id**, as discord.js reads them: `createdTimestamp` and `createdAt` are the time an
  `id` you give encodes, or, with the generated id, the time the mock was made. A `createdTimestamp` you set wins.
- **A mock without a `guildId` is a DM.** `inGuild()`, `inCachedGuild()` and `inRawGuild()` answer from the mock's
  `guildId` and `guild`, and in a DM `guild` and `member` are `null`.
- **An interaction has the channel it came from.** In a server, `channel` is a text channel of that server, the one
  its `guild` caches under `channelId`; in a DM, it's the user's DM channel. Its `send()` resolves, and its type
  guards, such as `isTextBased()`, answer as discord.js's do.
- **A channel you give sets where the mock is.** Given to `createMockInteraction` or `createMockMessage`, it sets the
  `channelId`, `guildId` and `guild` you leave out: a DM channel makes the mock a DM, and a server's channel puts it in
  that server. A server's channel that names no server goes in the mock's. A channel in another server than the
  `guild` you give, or a DM channel beside a `guildId`, is refused, naming both.
- **A member has roles and permissions.** An interaction's or a message's `member` has the server's @everyone role,
  and `permissions` and `memberPermissions` are computed from its roles as discord.js computes them, so a role or
  permission guard runs on a mock as it does in Discord.
- **A select menu has picked nothing unless given.** Its `values` are an empty array, and so are the collections of
  what its kind picks: `users` and `members`, `roles`, or `channels`, each an empty `Collection`. Give the choices a
  test needs in the overrides, as the `Collection`s discord.js holds: its `values` are then their ids, as Discord sends
  them.
- **Locales are set as Discord sends them.** `locale` is `'en-US'`, and `guildLocale` is `'en-US'` in a server and
  `null` in a DM, so a [translator](guide:localisation) works on a default mock.

::example{file="testing/mock-defaults.spec.ts" region="created"}

## Overrides

The second argument sets properties as the mock is built. It's the only way to set what discord.js makes read-only,
such as a modal's `customId` and `fields`, a component's `message`, a context menu's `targetUser`, or the `client`.
A misspelled property name is a compile error.

To put a command somewhere a user-installed app can be used, set `context` and `authorizingIntegrationOwners`:

::example{file="controllers/slash/stats.slash.controller.spec.ts" region="contexts"}

## Options and fields

[`createChatInputOptions(record)`](api:testing/createChatInputOptions) builds a command's options, found by name as
the real resolver finds them:

::example{file="testing/mocks.spec.ts" region="options"}

- A user, role, channel or attachment option is set both as the id and as the resolved object, so a handler that
  reads only one of the two is caught. A user option carries its user, and in a server its member: `getMember()` is
  `null` in a DM, and a member you give answers `getUser()` with its user.
- A whole number is an integer option and a fraction a number option, so `getInteger()` is `null` for `1.5`.
- A getter of the wrong type returns `null`. Asked with `required: true`, an option that is missing or of the wrong
  type throws.
- `subcommandGroup`, `subcommand` and `focused` are reserved names: the last names the option an autocomplete is
  typing.

A modal's submitted fields come from `createModalFields({ body: 'It crashed' })`, which discord.js doesn't let a
test build.

## Messages, servers and the rest

- **`createMockMessage()`** mocks a message that tracks whether it was deleted: `delete()`, `edit()`, `reply()` and
  the rest throw once it is. It takes an `id`, `content`, `components`, `embeds` and `flags`, and builders or JSON for
  the last three. What the content mentions is cached as the gateway delivers it: a `<@id>` in the client's
  `users.cache`, and in a server in `guild.members.cache`; a `<@&id>` role and a `<#id>` channel in their caches too.
- **`author`** sends a message as a user you give, such as one from `createMockUser()`, or `client.user` for one the
  bot sent. It's cached on the client, and in a server the message's `member` is the guild's cached member for that
  user, made and cached when there's none. Every message from that author has the same member, and so does an
  interaction given the same `user` in the same server.
- **`createMockGuild({ members, roles, channels })`** puts those in the server's caches, where a command's typed
  params are read from. Give it to `createMockMessage({ guild })`, or pass `guild: null` for a DM.
- **`createMockClient()`** has real, empty caches, and one bot user, the same in every mock, as `client.user`.
- **`createMockMember({ user, guild, roles, nickname })`** makes a member with the roles given; see
  [Members and roles](#members-and-roles).
- **`createMockUser()`** mocks a person, `bot: false`. A DM to the user, or to a member of theirs, goes through the
  user's one DM channel, which `createDM()` resolves to.
- **`createMockChannel(Class)`** mocks a channel of the class you pass, such as `TextChannel` or `ThreadChannel`. Its
  type guards answer for that class, and its managers, `messages`, `threads` or `members`, have real, empty caches,
  with the channel as their `channel`. Give one to `createMockMessage({ channel })` to send a message there, or to an
  interaction to have it come from there.
- **`createMock<Interface>()`** mocks a type with no class at runtime, such as a service's interface. A type has no
  shape at runtime, so every property is a mock function, data included: `if (settings.enabled)` always passes. Pass
  the values the code reads, `createMock<Settings>({ enabled: false })`.

Two messages from one `author` count against that member's cooldown, as they would from one person in Discord:

::example{file="testing/mock-author.spec.ts" region="author"}

A message and an interaction from that user in one server share the member:

::example{file="testing/mock-author.spec.ts" region="member"}

## Members and roles

[`createMockMember({ user, guild, roles, nickname })`](api:testing/createMockMember) makes a member of a server, with
the roles you give. Put it in `createMockGuild({ members })`, and an interaction or a message from its user in that
server has it as its `member`, so a role guard sees its roles:

::example{file="testing/mock-member.spec.ts" region="member"}

A role is a mock `Role` with the `id` a guard checks: `createMockInteraction(Role, { id })`. The member's
`roles.cache` holds the server's @everyone role, then the roles given, and `roles.add()`, `remove()` and `set()` change
them. `roles.highest` ranks them by position, then by id. Its `permissions` combine its roles', @everyone's included,
and the server's owner has every permission:

::example{file="testing/mock-member.spec.ts" region="permissions"}

A member made without a server joins the one whose `members` it's given to. An interaction's channel is one of that
server's, and a manager's `fetch(id)` finds what the server caches:

::example{file="testing/mock-member.spec.ts" region="channel"}

## What methods return

A method that returns a promise in discord.js resolves, so `await` and `.catch()` work with no setup:

| Method                                                          | Resolves to                                          |
| --------------------------------------------------------------- | ---------------------------------------------------- |
| `send()`, `reply()`, `crosspost()`, `forward()`, `fetchReply()` | a mock message                                       |
| a manager's `fetch(id)`, or `fetch({ user })` and the like      | its cached item with that id, or a new one it caches |
| a manager's `fetch()` for a list                                | an empty `Collection`                                |
| a manager's `create()` and `edit()`                             | a mock of its item                                   |
| `createDM()`                                                    | a mock DM channel                                    |
| a structure's own `edit()`, `fetch()`, `delete()` and setters   | the structure itself                                 |
| any other method that returns a promise                         | `undefined`                                          |

::example{file="testing/mock-defaults.spec.ts" region="promises"}

A method that returns a value at once, such as `avatarURL()`, returns `undefined`. A test still decides with
`mockReturnValue`, `mockResolvedValue` and `mockRejectedValue`.

## Collectors

A collector's callback answers a click with `respond()` after the handler has returned. It takes the theme of the app
the click's client belongs to, so a click a test builds must come from the same client as the call that started the
collector. The gateway does that for the bot; in a test, pass `{ client: interaction.client }`:

::example{file="testing/collector.spec.ts" region="collector"}

## Resetting between tests

Vitest's `clearMocks` and `restoreMocks` reach only `vi.fn()`, so `meocord/testing` has its own. `clearAllMocks()`
forgets what every mock it made has recorded. [`resetAllMocks()`](api:testing/resetAllMocks) also undoes what a test
told them, back to how each was created:

::example{file="testing/reset.spec.ts" region="reset"}

A generated project resets after every test from `vitest.setup.ts`, as [The testing module](guide:testing#running-tests)
shows. An older project gets the same by adding that file and `setupFiles: ['./vitest.setup.ts']` to its
`vitest.config.ts`.

## Discord's errors

[`createDiscordError(code)`](api:testing/createDiscordError) builds the `DiscordAPIError` discord.js throws, for a mock
to reject with:

- 10062: the three seconds to answer passed;
- 40060: the interaction was already acknowledged;
- 50001: missing access;
- 50027: the fifteen-minute token has expired.

`respond()` passes the error on to the handler, and [`getResponse`](api:testing/getResponse) keeps the refused call,
with its `error`, without counting it as sent:

::example{file="testing/mocks.spec.ts" region="errors"}

## Gotchas

- **A read-only property can't be assigned after creation.** TypeScript refuses `interaction.customId = …`, as
  discord.js declares it read-only. Set it in the overrides, where a misspelling is caught too.
- **A MeoCord mock you configure once is reset after the first test.** Set return values in the test that relies on
  them, or in `beforeEach`. A `vi.fn()` of your own only has its calls cleared.
- **A command's options aren't there by default.** A mock `ChatInputCommandInteraction` has no options until you
  assign `interaction.options = createChatInputOptions({ … })`.

## Next steps

- [Invoke and dispatch](guide:invoke-and-dispatch): running handlers with these inputs.
- [Testing recipes](guide:testing-recipes): themes, guards, cooldowns and collectors under test.
- [Message commands](guide:message-commands): the typed params a mock server's caches feed.
