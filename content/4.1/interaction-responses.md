---
id: interaction-responses
title: "Interaction responses"
order: 11
source: readme@4.1.0-beta.0
---

`respond(interaction)` from `meocord/common` is the one place an interaction is answered. It remembers where the answer stands and picks the right Discord call each time, so a handler says what to send, not how:

```typescript
import { respond } from 'meocord/common'

@Command('profile', CommandType.SLASH)
async profile(interaction: ChatInputCommandInteraction) {
  await respond(interaction).acknowledge() // "thinking…" while the profile loads
  const card = await this.profiles.render(interaction.user.id)
  await respond(interaction).send({ embeds: [card] })
}
```

| Call                                    | What it does                                                                                                                                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `acknowledge({ ephemeral })`            | A deferred reply for a command; an invisible deferred update for a component or a modal from a message. Once only, however often it is called.                                                                                                                                         |
| `send(payload)`                         | Replies to an unanswered command, updates an unanswered component's message, and edits once the interaction is deferred or replied. A second `send()` edits again.                                                                                                                     |
| `edit(payload)`                         | Edits the answer, as `send()` does once answered.                                                                                                                                                                                                                                      |
| `followUp(payload)`                     | Another message after the answer. While a command's reply is deferred and nothing is sent, Discord makes a follow-up that reply and ignores its flags, so it is sent as that edit — except a private follow-up on a public deferral, which deletes the deferral and is sent privately. |
| `delete()`                              | Deletes the answer.                                                                                                                                                                                                                                                                    |
| `modal(modal)`                          | Shows a modal. A modal must be the first response, so this throws once the interaction is acknowledged.                                                                                                                                                                                |
| `error(error, { message, visibility })` | Shows an error in the presenter's style, and never throws. `'reply'` may turn a public deferred reply into the error; `'private'` shows it only to the user who made the call.                                                                                                         |

`state` tells where the answer stands (`'unanswered'`, `'deferred'` or `'replied'`), re-read from the interaction on every call, so answers made directly with discord.js or by a collector still count. `message` is the message last sent or edited, `location` is what [`getInstallContext`](#where-the-interaction-happened) reports, and `original` holds the message's components and embeds from before `@Defer` locked it. `lock()` is `@Defer`'s second step, for a handler that acknowledges on its own. Interceptors and filters reach the same state as `context.response`.

Each call takes only the flags Discord accepts for it, computed afresh: an ephemeral follow-up never makes later messages ephemeral. `send()` and `followUp()` payloads are typed so an impossible flag does not compile. Once a message uses Components V2 its edits keep the flag, and content and embeds are dropped from them. When an edit re-sends an embed or Components V2 media whose image is one of the message's own Discord attachments, the URL is pointed at `attachment://` so the image survives the edit.

### `@Defer`

`@Defer()` acknowledges for the handler, in two steps, so a slow guard or handler never misses Discord's three seconds, and a stranger's click never touches someone else's message:

1. **Before guards**, a deferred reply for a command (`ephemeral: true` makes it private), or an invisible deferred update for a button, select menu or modal from a message.
2. **Once guards, validation and pipes allow the call**, for a component: its message's controls are disabled, the clicked button shows the loading emoji, and the presenter's loading view is added.

```typescript
@Command('refresh/{uid}', CommandType.BUTTON)
@UseGuard(OwnerGuard)
@Defer()
async refresh(interaction: ButtonInteraction, { uid }: { uid: string }) {
  await respond(interaction).send({ embeds: [await this.cards.render(uid)] }) // components come back as they were
}
```

`send()` without `components` puts the message's components back as they were before the lock — a button disabled on purpose stays disabled — and drops the loading view; `components: []` clears them. A handler that returns without answering has its message put back too, unless something else edited it meanwhile. When the handler throws, the error is shown privately and the message restored.

| Option                  | Default   | Effect                                                                                                                                                    |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ephemeral`             | `false`   | A command's deferred reply is private.                                                                                                                    |
| `disable`               | `'all'`   | `'clicked'` disables only the control used, so others stay usable: each click puts back its own control, whichever finishes first; `'none'` skips step 2. |
| `mode`                  | `'eager'` | `'auto'` acknowledges only if nothing answered after `after` ms, so a fast handler answers with one reply or update.                                      |
| `after`                 | `1500`    | For `'auto'`; never later than 2.5 s after the interaction was created.                                                                                   |
| `suppressNotifications` | `false`   | New messages (a first reply after `'auto'` waited, and follow-ups) do not notify.                                                                         |

A guard that returns `false` under `@Defer` leaves nothing behind: a command's deferred reply is deleted, and a component's message was never touched. To tell the user why, throw `GuardDeniedError`; it is answered privately. Answer through `respond()`, not `interaction.reply()`, which fails after the acknowledgement. `@Defer` is for interaction handlers: on a message, reaction, event or autocomplete handler it throws. A handler that shows a modal cannot use it, since a modal must be the first response.

### Where the interaction happened

A user-installed app can be used in servers the bot is not in and in direct messages between users, where the bot cannot use the channel API. `respond()` always answers through the interaction's own methods, which work everywhere, and turns to the channel only when the interaction's fifteen-minute token has expired and the bot is present; a token error from 14 minutes on counts as expired, allowing for a clock running late. Only edits can take that path: after fifteen minutes, an error can be logged but not shown privately, so a public card is put back without a private error. `getInstallContext(interaction)` reports the same thing to your code:

```typescript
import { getInstallContext } from 'meocord/common'

const { where, botInstalled } = getInstallContext(interaction) // where: 'guild' | 'bot-dm' | 'private-channel'
```

### Presenters

A presenter decides how MeoCord's answers look — the error view, and the loading view `@Defer` shows — while filters and the fallback decide what they say. It returns `{ text, title?, color?, emoji?, components? }`, rendered as an embed, or as a Components V2 container on a Components V2 message. Register one with `@MeoCord({ presenter })`; it is resolved once from the container, so it can inject services such as a `Translator`.

```typescript
import { Theme, Translator } from 'meocord/common'
import { MeoCord, Service } from 'meocord/decorator'
import { type PresentedError, type ResponseContext, type ResponsePresenter } from 'meocord/interface'
import enUS from '@src/locales/en-US'

@Service()
export class BrandPresenter implements ResponsePresenter {
  constructor(private readonly t: Translator<typeof enUS>) {}

  loading(context: ResponseContext) {
    return { text: this.t.for(context.interaction)('common.working'), emoji: '⏳', color: Theme.primaryColor }
  }

  error(_context: ResponseContext, { message }: PresentedError) {
    return { title: 'Something went wrong', text: message, color: Theme.errorColor }
  }
}

@MeoCord({ controllers: [...], clientOptions: { ... }, presenter: BrandPresenter })
class App {}
```

Without one, errors show "Oops!" as their title in `Theme.errorColor`, and the loading view is "⏳ Working on it…" in `Theme.primaryColor`.

---
