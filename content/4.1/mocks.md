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

## Overrides

The second argument sets properties as the mock is built. It is the only way to set what discord.js makes
read-only, such as a modal's `customId` and `fields`, a component's `message`, or a context menu's
`targetUser`. A misspelled property name is a compile error.

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
  and the rest throw once it is, and `edit()` and `reply()` resolve to a new mock message.
- `createMockUser()`, `createMockClient()`, `createMockGuild()` and `createMockChannel(Class)` mock the
  classes a handler reads most, with their managers stubbed.
- `createMock<Interface>()` mocks a type with no class at runtime, such as a service's interface.

## Discord's errors

`createDiscordError(code)` builds the `DiscordAPIError` discord.js throws, for a mock to reject with: 10062
when the three seconds to answer passed, 40060 when the interaction was already acknowledged, 50001 for
missing access, and 50027 when the fifteen-minute token has expired.

::example{file="testing/mocks.spec.ts" region="errors"}
