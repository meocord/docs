---
id: handler-discovery
title: 'Handler Discovery'
order: 20
source: readme@4.1.0-beta.0
---

`HandlerRegistry`, from `meocord/core`, lists every handler the app registered, with the metadata declared on it — for a `/help` command, an admin page or generated docs. Inject it like any service:

```typescript
import { Service } from 'meocord/decorator'
import { HandlerRegistry } from 'meocord/core'
import { Category } from '@src/common/category.metadata.js'

@Service()
export class HelpService {
  constructor(private readonly handlers: HandlerRegistry) {}

  commands() {
    return this.handlers
      .list({ kind: 'command' })
      .map(h => ({ path: h.name, description: h.description, category: h.get(Category) ?? 'Other' }))
  }
}
```

`list({ kind, controller })` filters by what a handler handles and by the class declaring it, and narrows the entries' type to that kind. Each entry has `controller`, `method`, `kind` and `name`, plus `get` and `getAll`, which read metadata as `ExecutionContext` does:

| `kind`         | `name`                                         | Also                                                          |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| `command`      | The command, or a subcommand's full path       | `commandType`, `command` (the registered JSON), `description` |
| `component`    | The customId pattern, such as `profile/{uid}`  | `commandType`                                                 |
| `modal`        | The customId pattern                           | `commandType`                                                 |
| `autocomplete` | The command path, then the option it completes |                                                               |
| `message`      | The keyword, or `undefined` for every message  |                                                               |
| `reaction`     | The emoji, or `undefined` for every reaction   |                                                               |
| `event`        | The client event                               | `once`                                                        |

---
