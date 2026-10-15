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
    testing/createMockRawMember,
    testing/createMockChannel,
    testing/createMockClient,
    testing/createMockUser,
    testing/createMock,
    testing/createModalFields,
    testing/createDiscordError,
    testing/clearAllMocks,
    testing/resetAllMocks,
    testing/createMockFn,
    testing/isMockFunction,
    testing/useMockFn,
    testing/useStrictMocks,
  ]
since: 4.0.0
---

A handler takes discord.js objects: an interaction, a message, a reaction, the user behind them. `meocord/testing`
mocks every one of them. A mock keeps its class's prototype chain, so `instanceof` holds at every level and a mock can
go straight to code that expects the real class.

Every method is a mock function, with `.mock.calls`, which Vitest's and Jest's matchers read. Vitest's `toHaveResolved`
and `toHaveBeenCalledBefore` read MeoCord's own mocks too. Their call order is counted across MeoCord's mocks, so
compare two of MeoCord's mocks, or two of the runner's, rather than one of each. Once
[`useMockFn`](#your-test-runners-mocks) is called, each of these methods is your test runner's own mock, and the runner
treats it as one of its own.
Under Node's test runner, assert through `.mock.calls` itself: each call is recorded as an array of its arguments,
`mock.calls[0][0]`, not node:test's `{ arguments }` record.

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
  from the class the mock was made from, all but the deprecated `isSelectMenu()`, which returns `undefined`: use
  `isStringSelectMenu()`. They're still mock functions, so a test can override one.
- **Replies follow Discord's rules.** Replying or deferring twice throws discord.js's `InteractionAlreadyReplied` error,
  and `followUp()`, `editReply()` and `deleteReply()` throw `InteractionNotReplied` before any reply. An answer a test
  gives a value with `mockResolvedValue` or `mockImplementation` counts as one. Under strict mocks, an interaction is
  marked `replied`, `deferred` or `responded` once its answer resolves, as discord.js marks it, so an `editReply()`,
  `followUp()` or `deleteReply()` made before an un-awaited first answer resolves rejects with `InteractionNotReplied`,
  and a second answer sent while the first is in flight is refused with Discord's 40060. A mock answer lands one
  microtask after the call, so strict mocks catch an edit or a second answer only when the code makes it before awaiting
  anything; after any `await` in between, the first answer has landed. In default mode the flags are set at the
  call, and the first overlap a bot would refuse warns. `fetchReply()` reads back what `reply()` or `update()` sent, as
  it was sent: a builder changed afterwards doesn't change it. After `deleteReply()`, and after a command shows a modal,
  `editReply()`, `fetchReply()` and `deleteReply()` reject with Unknown Message (10008), as does `fetchReply()` before
  any answer. A follow-up is reached by its id: `editReply({ message: followUp.id })`, and `followUp()` resolves to the
  follow-up it sent, as `fetchReply(id)` reads it. Under strict mocks, an answer whose components or embeds discord.js
  refuses to build, such as a button with no label, rejects at the call and leaves the interaction as it was; in default
  mode it warns once and is built when first read. `flags` are read as discord.js reads them, a number, an array, a name
  or a bitfield. An autocomplete's `respond()` works once, and refuses more than 25 choices.
- **Ids are Discord's shape.** An interaction gets an `id`, a `channelId` and a `user`, a person rather than a bot, each
  a snowflake no other mock in the run has. So does a user or an attachment made with `createMockInteraction`, and a
  message context menu's `targetId` is its `targetMessage`'s, or one made for its own id. Every generated id, a server's
  `ownerId` and a command's `commandId` included, comes from one count, so a run gives the same ids each time, and a
  value made on its first read is kept. Two mocks are two users, so a per-user cooldown counts them apart; give them one
  `user`, or one message `author`, to count them together. Ids you give are kept.
- **Creation times come from the id**, as discord.js reads them: `createdTimestamp` and `createdAt` are the time an
  `id` you give encodes, a thread's included. With a generated id, a message and an interaction were created when the
  mock was made. Under strict mocks so were a user, server and channel; in default mode they read their generated id's
  time, a day in 2025, with a warning. A `createdTimestamp` you set wins.
- **A mock without a `guildId` is a DM.** `inGuild()`, `inCachedGuild()` and `inRawGuild()` answer from the mock's
  `guildId` and `guild`, and in a DM `guild` and `member` are `null`. Under `useStrictMocks()`, a given `guild`, or a
  `member`'s guild, fills the interaction's `guildId`. In default mode, give the interaction its `guildId` with its
  `guild` or `member`: a `guild` alone leaves it a DM that still has that `guild`, and a `member` alone a DM with that
  `member` and no `guild`, and the mock warns.
- **An interaction has the channel it came from.** In a server, `channel` is a text channel of that server, the one
  its `guild` caches under `channelId`; in a DM, it's the user's DM channel. Its `send()` resolves, and its type
  guards, such as `isTextBased()`, answer as discord.js's do.
- **A channel you give sets where the mock is.** Given to `createMockInteraction` or `createMockMessage`, it sets the
  `channelId`, `guildId` and `guild` you leave out: a DM channel makes the mock a DM, and a server's channel puts it in
  that server. A server's channel that names no server goes in the mock's. A channel in another server than the
  `guild` you give, or a DM channel beside a `guildId`, is refused, naming both.
- **Under strict mocks, a message, guild or guildId places it too.** An interaction given a `message` is in the
  message's channel and server; given a `guild`, or a member of a server, it is in that server; given a `guildId` alone,
  it is in a server the bot isn't in, with `guild` and `channel` `null` and a raw member. A `channel`, `guild` or
  `guildId` other than a place the test gave the message is refused, naming both; a message whose place
  `createMockMessage()` made itself moves to the interaction's. In default mode only a channel places it, and reading
  where it is warns once where strict mocks place it otherwise.
- **A member has roles and permissions.** An interaction's or a message's `member` has the server's @everyone role, and
  `permissions` and `memberPermissions` are computed from its roles as discord.js computes them, so a role or permission
  guard runs on a mock as it does in Discord. Under `useStrictMocks()`, `memberPermissions` applies the interaction's
  channel's overwrites on top of them, a thread's parent's for a thread, as discord.js does, and an administrator or the
  server's owner has every permission. In default mode it leaves them out, and warns where they would differ.
- **A select menu has picked nothing unless given.** Its `values` are an empty array, and so are the collections of
  what its kind picks: `users` and `members`, `roles`, or `channels`, each an empty `Collection`. Give the choices a
  test needs in the overrides, as the `Collection`s discord.js holds: its `values` are then their ids, as Discord sends
  them.
- **An interaction has a client.** One made without a `client` gets one from `createMockClient()`, as a message does:
  its user is in `client.users.cache`, its channel in `client.channels.cache` once read, and `client.user` is the
  mock bot.
- **Locales are set as Discord sends them.** `locale` is `'en-US'`, and `guildLocale` is `'en-US'` in a server and
  `null` in a DM, so a [translator](guide:localisation) works on a default mock.

::example{file="testing/mock-defaults.spec.ts" region="created"}

## Overrides

The second argument sets properties as the mock is built. It's the only way to set what discord.js makes read-only, such
as a modal's `customId` and `fields`, or the `client`. A misspelled property name is a compile error.

To put a command somewhere a user-installed app can be used, set `context` and `authorizingIntegrationOwners`:

::example{file="controllers/slash/stats.slash.controller.spec.ts" region="contexts"}

Under strict mocks, a `guild` places it in that server, and a `guildId` alone in a server the bot isn't in, with a raw
member. In default mode, give a server's `guildId` with its `guild`, and for a server the bot isn't in a member from
`createMockRawMember()`, as [A server the bot isn't in](#a-server-the-bot-isnt-in) shows.

## Options and fields

[`createChatInputOptions(record)`](api:testing/createChatInputOptions) builds a command's or an autocomplete's options,
found by name as the real resolver finds them:

::example{file="testing/mocks.spec.ts" region="options"}

- A user, role, channel or attachment option is set both as the id and as the resolved object, so a handler that reads
  only one of the two is caught. `getAttachment()` returns the `Attachment` given, and `null` for an option not given. A
  user option carries its user, and in a server its member: `getMember()` is `null` in a DM, and a member you give
  answers `getUser()` with its user. In an autocomplete, Discord sends a user, member, role, channel, mentionable or
  attachment option as its id: under strict mocks it holds the id only, as the handler's params do, and its getter
  returns `null`, or throws discord.js's error when asked with `required: true`. Give the object, not a bare id, which
  reads as a string option. In default mode the object is kept, and a warning names the options once.
- Each getter reads its option as discord.js does, and throws discord.js's own error: a `TypeError` with its `code`. A
  getter of another type throws, whether or not it's asked with `required: true`: `getInteger()` on `1.5`, a number
  option, throws `Option "x" is of type: 10; expected 4.`, while a whole number reads as either. A user or member read
  as a role, or a role read as a user or member, is `null`, or that error when asked with `required: true`, since the
  option may be a mentionable one.
- A missing option asked with `required: true` throws `Required option "x" not found.`, and `getSubcommand()` throws
  when there's none, unless given `false`, as in discord.js. So does `getChannel()` given `channelTypes`, for a channel
  of another type, and `getFocused()` when no option is `focused`.
- `subcommandGroup`, `subcommand` and `focused` are reserved names: the last names the option an autocomplete is
  typing. Its value reads as Discord sends it, a string, `''` when none is given, through `getFocused()`,
  `getFocused(true)` and `options.data` alike. A number given for it is its digits under strict mocks. The focused
  option is in `options.data`, so with no value given an autocomplete handler's params hold it as `''`, such as
  `{ query: '' }`.
- Under strict mocks the focused option is read by its name too, as discord.js reads it: before anything is typed
  `getString()` reads `''` and `get()` returns it, marked `focused`; a typed whole number reads through `getInteger()`
  only, and one with a fraction through `getNumber()`, and `getString()` on either throws discord.js's type error; and
  one given no value takes any of the string, integer and number getters, since the mock doesn't know its declared type.
  In default mode these getters read as before, `null` for an option given no value, with a warning once.
- `getMentionable()` on a user option returns the user's member in a server and the user in a DM under strict mocks,
  as discord.js reads `member ?? user`. In default mode it returns the user, with a warning once.

A modal's submitted fields come from [`createModalFields({ body: 'It crashed' })`](api:testing/createModalFields), which
discord.js doesn't let a test build. A file upload field takes an array of `Attachment`s:
`createModalFields({ screenshot: [attachment] })`. An empty array is a select with nothing chosen. Give an upload at
least one `Attachment`.

## Messages, servers and the rest

- **`createMockMessage()`** mocks a message that tracks whether it was deleted: `delete()`, `edit()`, `reply()`,
  `react()`, `pin()` and `unpin()` throw once it is. It takes an `id`, `content`, `components`, `embeds` and `flags`,
  and builders or JSON for `components` and `embeds`. It holds them as discord.js's classes, an `ActionRow` with its
  `ButtonComponent`s, a `ContainerComponent`, an `Embed` and the rest, built from their JSON at the time of the call.
  What the content mentions is cached as the gateway delivers it: a `<@id>` in the client's `users.cache`, and in a
  server in `guild.members.cache`; a `<@&id>` role and a `<#id>` channel in their caches too.
- **`author`** sends a message as a user you give, such as one from `createMockUser()`, or `client.user` for one the
  bot sent. It's cached on the client, and in a server the message's `member` is the guild's cached member for that
  user, made and cached when there's none. Every message from that author in one `guild` you give has the same member,
  and so does an interaction given the same `user` and `guild`, with its `guildId` in default mode. `message.member`
  reads that cache each time, so a test that deletes the author's member from `guild.members.cache` gets `null`, as
  discord.js gives for an author it hasn't cached.
- **`createMockGuild({ members, roles, channels })`** puts those in the server's caches, where a command's typed
  params are read from. Give it to `createMockMessage({ guild })`, or pass `guild: null` for a DM.
- **`createMockClient()`** has real, empty `users`, `channels` and `guilds` caches, and a bot user as `client.user`,
  with the same id in every mock client, so a message can mention the bot by it.
- **`createMockMember({ user, guild, roles, nickname })`** makes a member with the roles given; see
  [Members and roles](#members-and-roles).
- **[`createMockUser()`](api:testing/createMockUser)** mocks a person, `bot: false`. A DM to the user, or to a member
  of theirs, goes through the user's one DM channel, which `createDM()` resolves to. That channel has the user as its
  `recipient`, and is the user's `dmChannel` once made. Under strict mocks, a client's `users.createDM(user)` resolves
  to it and `users.send(user, options)` sends through it, and the channel's `client` is the user's. In default mode
  `users.createDM()` gives every user the same channel, `users.send()` resolves to an empty message, and a test that
  reads a DM channel's `client` gets a client of its own, each with a warning once.
- **`createMockChannel(Class)`** mocks a channel of the class you pass, such as `TextChannel` or `ThreadChannel`. Its
  type guards answer for that class, and its managers, `messages`, `threads` or `members`, have real, empty caches, with
  the channel as their `channel`, and as `thread` on a thread's `members`. Give one to `createMockMessage({ channel })`
  to send a message there, or to an interaction to have it come from there.
- **[`createMock<Interface>()`](api:testing/createMock)** mocks a type with no class at runtime, such as a service's
  interface. A type has no shape at runtime, so every property is a mock function, data included:
  `if (settings.enabled)` always passes. Pass the values the code reads, `createMock<Settings>({ enabled: false })`.

Two messages from one `author` count against that user's cooldown, as they would from one person in Discord:

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

What discord.js computes from these, the mocks compute too, and keep computing after `resetAllMocks()`:

- `role.comparePositionTo(other)` and `guild.roles.comparePositions(a, b)` rank by position, then by id;
- `channel.permissionsFor(member)` and `member.permissionsIn(channel)` apply the channel's `permissionOverwrites` to
  the member's roles, and an interaction's `appPermissions` are the bot's in its channel. A thread's `permissionsFor()`
  reads its parent's under strict mocks, and returns `undefined` in default mode;
- a manager's `resolve()` and `resolveId()` read its cache, given an id or the item, and `guild.members.resolve(user)`
  finds that user's member;
- `guild.members.me` is the bot's member: the cached one for `client.user`, or one with @everyone, made once.

A member made without a server joins the one whose `members` it's given to. An interaction's channel is one of that
server's, and a manager's `fetch(id)` finds what the server caches:

::example{file="testing/mock-member.spec.ts" region="channel"}

### A server the bot isn't in

A user-installed command can run in a server the bot isn't in. discord.js then has no server to cache the member in,
so `interaction.member` is the member Discord sent: plain data, with `roles` as role ids and `permissions` as a
string. [`createMockRawMember()`](api:testing/createMockRawMember) builds it. Give it as the interaction's `member`,
with the server's `guildId` and no `guild` or `channel`:

- `inRawGuild()` is true and `inCachedGuild()` false, and `guild` and `channel` are `null`, with its `channelId` kept;
- `user` is the member's user, and `memberPermissions` are the `permissions` you give the raw member, which Discord
  sends with the channel's overwrites applied;
- a user option's member is the member Discord resolves, with `roles` and `permissions` but no `user`;
- the interaction is typed as discord.js types one from such a server, so the compiler sees `member` as raw data.

It takes the roles, permissions and user to give it, such as
`createMockRawMember({ roles: [moderatorId], permissions: [PermissionFlagsBits.KickMembers] })`. A guard that reads
`member.roles.cache` throws there, as it does in Discord, so a test of such a command finds the branch a handler needs:
`interaction.inCachedGuild()` before reading the cache, or `member.roles` as ids.

## What methods return

A method that returns a promise in discord.js resolves, so `await` and `.catch()` work with no setup. A server's
`emojis`, `stickers`, `scheduledEvents`, `autoModerationRules` and `invites` managers answer as its other managers do:

| Method                                                                                                                        | Resolves to                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `send()`, a message's `reply()`, `crosspost()`, `forward()`, and an interaction's `editReply()`, `followUp()`, `fetchReply()` | a mock message in the channel it was sent in, holding what was sent                  |
| an interaction's `reply()`, `deferReply()`, `update()`, `deferUpdate()`, `showModal()`                                        | `undefined`                                                                          |
| a manager's `fetch(id)`, or `fetch({ user })` and the like                                                                    | its cached item with that id, a message made in that channel, or a new one it caches |
| a guild's `members.fetch({ user: ids })`                                                                                      | a `Collection` of each, as `fetch(id)` gives it                                      |
| a manager's `fetch()` for a list                                                                                              | an empty `Collection`; under strict mocks, a channel's messages                      |
| a manager's `create()` and `edit()`                                                                                           | a mock of its item; under strict mocks, the item asked for                           |
| `createDM()`                                                                                                                  | the user's DM channel                                                                |
| a member's `kick()`, `ban()` and `timeout()`                                                                                  | the member                                                                           |
| `awaitMessages()` and `awaitReactions()`                                                                                      | an empty `Collection`, as nothing answers a mock                                     |
| a structure's own `edit()`, `fetch()`, `delete()` and setters, but a message's `delete()`                                     | the structure itself                                                                 |
| a message's `delete()`, `pin()` and `unpin()`                                                                                 | `undefined`                                                                          |
| any other method that returns a promise                                                                                       | `undefined`                                                                          |

::example{file="testing/mock-defaults.spec.ts" region="promises"}

Under strict mocks, a channel caches each message made in it, or sent there through `send()` or `reply()`, as
discord.js caches messages as they arrive, and its `messages.fetch()` with no id lists them, newest first, honouring
`limit`, 50 by default, `before`, `after` and `around`. `guild.channels.create()` makes the type its options name, a
manager's `edit(id, options)` resolves to the item with that id, and a `name` given to `create()` or `edit()` names
the item. In default mode a channel's `messages.cache` stays as it was, `fetch()` for a list resolves to an empty
`Collection`, `create()` makes a text channel, and `edit()` a new item under another id, each with a warning once. In
both modes a thread a channel's thread manager creates or fetches has that channel as its `parent`.

A method that returns a value at once returns what discord.js computes where the mock has what it needs: `resolve()`,
`comparePositionTo()`, `permissionsFor()` (a thread's, or a channel's made without a server, only under strict
mocks), `message.mentions.has(user)`,
`isReady()`, and `avatarURL()` and `iconURL()`, `null` with no avatar or icon set. Any other returns `undefined`. A test
still decides with `mockReturnValue`, `mockResolvedValue` and `mockRejectedValue`.

## Values discord.js computes

Some of what discord.js computes depends on Discord's state: who sent a message, the bot's roles and permissions, a
channel's overwrites. Unless told otherwise, a mock reads these as a truthy placeholder:

- a message's `editable`, `deletable`, `pinnable`, `crosspostable`, `bulkDeletable` and `hasThread`;
- a member's `manageable`, `kickable`, `bannable` and `moderatable`;
- a role's `editable`, and a channel's `viewable`, `manageable` and `deletable`, and their thread and voice
  counterparts, a voice channel's `full` among them;
- `partial` on messages, users, channels and reactions.

The first time a test reads one, the run logs a warning that names it and says how to set it. Set the value the test
relies on, such as `message.editable = false` or `member.kickable = false`, and it is read without a warning.

Some data discord.js gives empty, `null` or `false`, also reads as a truthy placeholder: a reaction's `me`,
`message.mentions.repliedUser`, a message's `editedAt`, a member's `presence`, a server's `verified` and
`systemChannel`, a channel's `parent`, and a modal's `message`. A reaction made without a message has a placeholder
`message` too, though discord.js always gives a reaction its message. Reading one warns the same way, naming the value
to set, such as `reaction.me = false` or `reaction.message = createMockMessage()`. When MeoCord's dispatcher reads a
reaction's placeholder `partial`, it fetches the reaction, and the warning says so: set `reaction.partial = false` and
`reaction.message.partial = false`, or use strict mocks.

`message.thread` is the thread the message's channel caches under the message's id. For a message that started a thread,
cache one on the message's channel with `channel.threads.cache.set(message.id, thread as PublicThreadChannel<false>)`,
`thread` from `createMockChannel(ThreadChannel)`. Without one, it is a placeholder thread, with a warning, since
discord.js reads `null` there.

### Strict mocks

[`useStrictMocks()`](api:testing/useStrictMocks), called once in a test setup file before any mock is made, has the
mocks compute each of these with discord.js's own code, and `message.thread` read `null` without a cached thread. No
placeholder warning is logged. The mocks hold what those computations read, as Discord sends it:

- the bot's member is in its server's member cache from the start;
- @everyone has the permissions Discord gives it in a new server: the bot can view and send in a channel and join a
  voice channel, but not manage, pin, kick or ban. In default mode it has none, and a read that would differ warns until
  the test gives @everyone its permissions, as a role with the server's id, which is its @everyone:
  `createMockGuild({ id, roles: [createMockInteraction(Role, { id, permissions })] })`;
- a channel or thread made without a server has one of its own, a thread with a text channel as its parent. In
  default mode such a channel's `permissionsFor()`, `overwritesFor()`, `memberPermissions()` and `rolePermissions()`
  return `undefined`, as a thread's do, with a warning once;
- a client's `users.createDM()` and `users.send()` reach the user's own DM channel, whose `client` is the user's;
- a channel caches the messages made or sent in it, and its `messages.fetch()` with no id lists them;
- `guild.channels.create()` makes the type named, `create()` and `edit()` apply a `name`, and `edit(id)` resolves to
  that item;
- those values read as discord.js gives them: `me` is `false`, `repliedUser` and a modal's `message` are `null`, and
  `editedAt`, `presence`, `verified`, `systemChannel` and `parent` are computed from what the mock holds;
- a reaction made without a message has a whole one, so a dispatched reaction isn't fetched;
- a message the bot sends is its `client.user`'s, and one it sends in a DM is in that DM;
- an autocomplete's user, member, role, channel, mentionable or attachment option is its id, as Discord sends it,
  and its focused option is read by name, `''` before anything is typed;
- `getMentionable()` on a user option gives the user's member in a server;
- an interaction's `ephemeral` is `null` until `reply()` or `deferReply()` decides it. In default mode it reads `false`
  until then, and reading it warns once.

So a message another user sent isn't `editable` or `deletable`, and a member isn't `kickable` until the bot's member has
a role above theirs with Kick Members. Give the bot's member that role, through `guild.members.me!.roles.add(role)`, and
the values follow. A value the test sets on a mock still wins over the computed one. Under strict mocks, `invoke` also
refuses a handler given fewer arguments than it declares where it builds none, such as a reaction handler given the
reaction without its `ReactionEvent`, naming what to pass, and an autocomplete that dispatch gives to another
`@Autocomplete` handler or to none; `compile()` refuses an override stub without its stage's method. A generated
project's `vitest.setup.ts` makes this call. A second answer after one a test set, which discord.js refuses, runs with a
warning in default mode; under strict mocks it throws, as discord.js does.

A testing module follows the bot more closely under strict mocks too, each with a warning once in default mode:

- `dispatch()` reports a call whose answer fails to build once, as `'error'`, as the bot does. In default mode an
  interaction's observers hear it twice, first with its own outcome. `dispatch()` rejects with that failure either way.
- `emit()` sets the module's presenter, theme and translator on the client of each event argument, as the bot sets them
  on its own client, and a module without a presenter answers with MeoCord's default on a client another module used.
- [`inspectHandler`](api:testing/inspectHandler) lists only the guards, interceptors and observers dispatch runs for
  the handler's context types, and its `inheritedRoutes` names an inherited `@On` or `@Once` event too, such as
  `event "guildCreate"`, which default mode leaves out.

## Collectors

A collector's callback answers a click with `respond()` after the handler has returned. It takes the theme of the app
the click's client belongs to, so a click a test builds must come from the same client as the call that started the
collector. The gateway does that for the bot; in a test, pass `{ client: interaction.client }`:

::example{file="testing/collector.spec.ts" region="collector"}

## Your test runner's mocks

[`useMockFn(vi.fn)`](api:testing/useMockFn), called once in a test setup file, has `meocord/testing` make every mock
with the runner's own mock function. The runner then treats them as its own: Vitest's `clearMocks` and `mockReset`
config and `vi.clearAllMocks()` reach them, and `vi.mocked(interaction.reply)` gives Vitest's whole mock API, such as
`withImplementation`. A generated project's `vitest.setup.ts` makes this call.

- **jest** takes `useMockFn(jest.fn)`, in a file its `setupFiles` lists.
- **bun test** takes `useMockFn(mock)`, with `mock` from `bun:test`, in a file `bunfig.toml` preloads. Bun's matchers,
  such as `toHaveBeenCalledWith`, read only bun's own mocks, so this is what lets them read MeoCord's.
- **node:test** keeps MeoCord's own mock function: its `mock.fn` records calls in a shape of its own, which
  `useMockFn` refuses.

Call it before any mock is made. Once a mock exists, a call with another function throws, since the two kinds would mix.
A setup file runs first, so that is where it goes. What it sets, with `useMockFn()` or `useStrictMocks()`, holds for
every test, through `vi.resetModules()`, `jest.resetModules()` and Jest's `resetModules` config, and the mocks'
generated ids keep counting through them.

[`createMockFn(impl?)`](api:testing/createMockFn) makes a stand-alone mock function of the same kind, the runner's own
once `useMockFn` is called; `clearAllMocks()` and `resetAllMocks()` reach it.
[`isMockFunction(fn)`](api:testing/isMockFunction) tells a mock from a real function.

## Resetting between tests

[`clearAllMocks()`](api:testing/clearAllMocks) forgets what every mock from `meocord/testing` has recorded.
[`resetAllMocks()`](api:testing/resetAllMocks) also undoes what a test told them, back to how each was created:

::example{file="testing/reset.spec.ts" region="reset"}

What a mock holds outside its methods stays: an interaction already answered stays `replied`, and a deleted message
stays deleted. Make a fresh mock in each test, or in `beforeEach`, rather than one at a spec's top level.

A generated project resets after every test from `vitest.setup.ts`, as [The testing module](guide:testing#running-tests)
shows. A project without it gets the same by adding that file and `setupFiles: ['./vitest.setup.ts']` to its
`vitest.config.ts`.

Under Vitest, its own `mockReset` puts a mock back to how it was created, so its config works too. Under jest and
bun, a runner's `mockReset` drops a mock's starting behaviour, and with it what MeoCord's mocks do, such as an
interaction refusing a second reply. Reset there with `resetAllMocks()`, which puts that behaviour back, and leave
jest's `resetMocks` off.

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

A manager's `fetch(id)` finds or makes the item it's asked for, so a test of an ID that isn't a member, or of a user
that doesn't exist, rejects the fetch with Discord's code:
`guild.members.fetch.mockRejectedValue(createDiscordError(10007))` for a member, and
`message.client.users.fetch.mockRejectedValue(createDiscordError(10013))` for a user. A typed message param that names
that ID is then refused, as "is not a member of this server" or "no user has the ID …". Use `mockRejectedValue` rather
than `mockRejectedValueOnce`: a message naming several IDs fetches them together, then one by one when that fails. A
mention never reaches the fetch, since a member it names comes from the message's mentions.

## Gotchas

- **A read-only property can't be assigned after creation.** TypeScript refuses `modal.customId = …` on a
  `ModalSubmitInteraction`, as discord.js declares it read-only. Set it in the overrides, where a misspelling is caught
  too.
- **In a generated project, a MeoCord mock you configure once is reset after the first test.** `vitest.setup.ts` resets
  MeoCord's mocks after every test, and `clearMocks` clears your own `vi.fn()`. Set return values in the test that
  relies on them, or in `beforeEach`.
- **A command's options aren't there by default.** A mock `ChatInputCommandInteraction` has no options until you
  give `options: createChatInputOptions({ … })` in its overrides, or assign it afterwards.
- **A mock's `reply`, `deferReply`, `update` and `deferUpdate` resolve to `undefined`**, though their types say
  `InteractionResponse`. To test a collector on the response, give it one:
  `interaction.reply.mockResolvedValue(response)`, with `response` from `createMock<InteractionResponse>()` and its
  `createMessageComponentCollector` set to return your collector. The interaction is then `replied`, as with the default
  mock.
- **`useStrictMocks()` goes before the first mock.** Called once a mock exists, it throws "useStrictMocks() goes before
  any mock is made: …". Call it in the test setup file, not inside a test or after a mock made at a spec's top level.

## Next steps

- [Invoke and dispatch](guide:invoke-and-dispatch): running handlers with these inputs.
- [Testing recipes](guide:testing-recipes): themes, guards, cooldowns and failure paths under test.
- [Message commands](guide:message-commands): the typed params a mock server's caches feed.
