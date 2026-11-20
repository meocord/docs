---
id: handler-discovery
title: Handler discovery
chapter: structure
order: 5
summary: List every handler your bot registered, with its metadata, for a help command, an admin page or generated docs.
learn:
  - Inject the registry and list handlers by kind or controller
  - Write a help command for slash and message commands
  - Read your own metadata from each handler
requires: [services, message-commands]
api: [controllers/HandlerRegistry, controllers/HandlerEntry, types/MessageHelp]
since: 4.1.0
---

[`HandlerRegistry`](api:controllers/HandlerRegistry), from `meocord/core`, lists every handler the app registered:
commands, components, modals, autocomplete, message, reaction and event handlers, on every controller and service.
Each entry carries what was declared on it, so a help command reads the same names and descriptions Discord shows.

## When to use it

Use it for anything that describes the bot from its own code: a `/help` or `!help` command, a page of commands on an
admin dashboard, a list of events for a startup log, or generated documentation. A new command then shows up in
all of them without another edit.

To find which handler a message or a custom ID would reach, in a test, use [`resolveRoute`](api:testing/resolveRoute)
instead.

## Example

::example{file="services/help.service.ts" region="service"}

Inject it like any [service](guide:services). `list({ kind: 'command' })` returns one entry per slash command,
subcommand and context menu command. The service keeps the slash ones, by their `commandType`, and `/help` replies with
a line for each.

## How it works

The registry reads the handlers of every controller and service the app binds, and the `@On` and `@Once` handlers of
every other instance whose lifecycle hooks run, such as a service only a guard injects, the cooldown store aside. It
reads them on the first `list()`, and again once the bot's providers are made, so a list made from a provider's factory
is complete once the bot is online. Entries come class by class, in the order the app makes them, each class after what
it injects, then the classes only events reach.

`list({ kind, controller })` filters by what a handler handles, by the class declaring it, or both, and narrows the
entries' type to that kind. Every entry has `controller`, `method`, `kind` and `name`:

| `kind`         | `name`                                         | Also                                                                                      |
| -------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `command`      | The command, or a subcommand's full path       | `commandType`, `command` (the registered JSON), `description`                             |
| `component`    | The custom ID pattern, such as `profile/{uid}` | `commandType`                                                                             |
| `modal`        | The custom ID pattern                          | `commandType`                                                                             |
| `autocomplete` | The command path, then the option it completes |                                                                                           |
| `message`      | The pattern, or none for every message         | `command`, `aliases`, `description`, `scope`, `hidden`, `usage(prefix)`, `matches(words)` |
| `reaction`     | The emoji, or none for every reaction          |                                                                                           |
| `event`        | The client event                               | `once`                                                                                    |

A subcommand's `description` is its own, and a context menu command has none.

## Message commands

A message command is listed once, with the `aliases` and `description` its handler declares, and its `scope`, which a
`member`, `role` or `channel` param, or a required flag of those types, narrows to servers:

::playground{file="controllers/message/moderation.message.controller.ts" region="metadata" dispatch="message m <@140000000000000014> 1h"}

For a help command, `messageHelp(message, query?)` answers as the [built-in `!help`](guide:message-commands) would: the
commands that work where they asked, leaving out hidden and guarded ones, or the one `query` names, its subcommands, or
that nothing matches or there is nothing to list. It returns a [`MessageHelp`](api:types/MessageHelp) to write your own
way, with each param's label in the server's language where the app [translates MeoCord's texts](guide:localisation):

::example{file="controllers/message/help.message.controller.ts" region="help"}

An entry's `usage('!')` writes the command as a user types it, such as `!mute <target> [duration] [reason…]`, and
`matches(words)` tells whether words name it or one of its aliases, with the same case rules as the handler, for a
listing that is not a help command.

## Your own metadata

`get` and `getAll` read metadata declared on a handler, the method's first and then its controller's, as
`ExecutionContext` does. A category made with `createMetadata` and set on each controller groups a help command's lines:
`handler.get(Category) ?? 'Other'`. [Custom decorators](guide:custom-decorators) shows how to make one. A string or
symbol key works too, and is deprecated as it is on `ExecutionContext`; 5.0 removes it.

## Testing

A testing module binds a registry of the controllers, services and providers it's given, so a test lists exactly their
handlers:

::example{file="services/help.service.spec.ts" region="spec"}

::example{file="controllers/message/help.message.controller.spec.ts" region="spec"}

## Gotchas

- **Listed isn't always run.** `list()` lists every handler of a class the app binds: a controller in `controllers`, a
  service in `services`, or a class one of them injects. Of any other instance whose lifecycle hooks run but the
  cooldown store, it lists the `@On` and `@Once` handlers only. A command, component, modal, autocomplete, message or
  reaction handler runs only on a controller in `controllers`; one on any other class is listed but never runs, and the
  bot warns at startup, naming it, so move it to a controller. An `@On` or `@Once` handler runs wherever it's listed.
- **A subcommand is its own entry.** `/settings notify email` is listed by its full path; group entries by their
  first word for one line per top-level command.
- **The prefix isn't known to an entry.** Pass the one users type to `usage()`; an app with several prefixes picks
  one to show.

## Next steps

- [Message commands](guide:message-commands): the patterns, aliases and scope a help command reads.
- [Custom decorators](guide:custom-decorators): declare your own metadata, such as a category, on handlers.
- [The request pipeline](guide:how-a-call-runs): what runs around each handler the registry lists.
