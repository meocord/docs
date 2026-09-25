---
id: gateway-events
title: 'Gateway Events'
order: 19
source: readme@4.1.0-beta.0
---

`@On(event)` handles a discord.js client event every time it is emitted, and `@Once(event)` the first time only. Put them on a controller or a service; the handler's parameters are typed from discord.js's `ClientEvents`:

```typescript
import { Controller, On, Once } from 'meocord/decorator'
import { type Client, type GuildMember } from 'discord.js'
import { WelcomeService } from '@src/services/welcome.service.js'

@Controller()
export class WelcomeController {
  constructor(private readonly welcome: WelcomeService) {}

  @On('guildMemberAdd')
  async greet(member: GuildMember) {
    await this.welcome.send(member)
  }

  @Once('clientReady')
  async warmCache(client: Client<true>) {
    await client.guilds.fetch()
  }
}
```

- **Where**: on any controller or service the app binds — listed in `@MeoCord({ controllers, services })` or injected by one. The instance is resolved when the first event arrives.
- **Guards and interceptors**: an event handler runs through the same pipeline as a command. `@UseGuard` and `@UseInterceptor` on the method or the controller, and the global ones from `@MeoCord({ guards, interceptors })`, apply; a guard receives the event's arguments, and `ExecutionContext.getType()` is `'event'`. A global guard written for interactions should declare `@Guard({ types: ['interaction'] })`, so it skips events; at startup MeoCord names each global guard or interceptor without `types` that will also run on events. A guard or interceptor that throws on an event is logged like any handler error.
- **Errors** a handler throws go to its exception filters, as a command's do. One no filter handles is logged with the event and the handler's name, never answered, and never stops the bot or the other handlers of that event.
- **Intents**: at startup MeoCord warns once for each intent or partial your handlers need that `clientOptions` lacks — `GuildMembers` for `guildMemberAdd`, say — and reminds you to enable privileged intents in the Discord developer portal. `@MessageHandler` and `@ReactionHandler` are checked the same way. If Discord then refuses a privileged intent at login, the bot logs which ones it requests and where to enable them — Developer Portal → your application → Bot → Privileged Gateway Intents — and `app.start()` rejects with an error `isExplainedError(error)` recognises, so the generated `main.ts` does not log it a second time with its stack trace.
- `@On('interactionCreate')` and `@On('messageCreate')` run alongside MeoCord's own dispatch of those events.
- **Names**: `@Once` and `@Cooldown` tell classes apart by name, so the bot refuses to start when two classes share a name and either has a `@Once` handler; rename one of them.

In a test, `module.emit(event, ...args)` sends an event to the module's handlers through the same pipeline:

```typescript
const module = MeoCordTestingModule.create({ controllers: [WelcomeController], providers: [...] }).compile()

const { ran } = await module.emit('guildMemberAdd', createMock<GuildMember>())
expect(ran).toBe(1)
```

`emit` resolves to how many handlers ran, and rejects once they have all settled if any threw: with that error, or an `AggregateError` when several did.

---
