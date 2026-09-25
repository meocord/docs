---
id: handler-discovery
title: Handler discovery
section: Beyond commands
order: 53
since: 4.1.0
---

`HandlerRegistry`, from `meocord/core`, lists every handler the app registered, with the metadata declared
on it: for a `/help` command, an admin page or generated documentation. Inject it like any
[service](/docs/4.1/services):

::example{file="services/help.service.ts" region="service"}

`list({ kind, controller })` filters by what a handler handles and by the class declaring it, and narrows
the entries' type to that kind. Each entry has `controller`, `method`, `kind` and `name`, plus `get` and
`getAll`, which read metadata as `ExecutionContext` does, such as a category made with `createMetadata`
([Custom decorators](/docs/4.1/custom-decorators)).

| `kind`         | `name`                                         | Also                                                          |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `command`      | The command, or a subcommand's full path       | `commandType`, `command` (the registered JSON), `description` |
| `component`    | The customId pattern, such as `profile/{uid}`  | `commandType`                                                 |
| `modal`        | The customId pattern                           | `commandType`                                                 |
| `autocomplete` | The command path, then the option it completes |                                                               |
| `message`      | The pattern, or none for every message         |                                                               |
| `reaction`     | The emoji, or none for every reaction          |                                                               |
| `event`        | The client event                               | `once`                                                        |

The testing module binds a registry of the controllers it is given:

::example{file="services/help.service.spec.ts" region="spec"}
