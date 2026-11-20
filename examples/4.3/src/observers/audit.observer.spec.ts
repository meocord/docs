import { ChatInputCommandInteraction } from 'discord.js'
import { createMockInteraction, inspectHandler, MeoCordTestingModule } from 'meocord/testing'
import { describe, expect, it } from 'vitest'
import App from '@src/app-with-observers'
import { ModerationSlashController } from '@src/controllers/slash/moderation.slash.controller'
import { ChannelGuard } from '@src/guards/channel.guard'
import { AuditObserver } from '@src/observers/audit.observer'
import { CallSpanObserver } from '@src/observers/call-span.observer'
import { MetricsObserver } from '@src/observers/metrics.observer'
import { RefusalLog } from '@src/services/refusal-log.service'
import { MetricsService } from '@src/services/metrics.service'

// #region spec
describe('observers', () => {
  // The app's observers, and its interceptors, apply as they do in the bot
  const module = MeoCordTestingModule.create({ app: App, controllers: [ModerationSlashController] }).compile()

  it('are told about a call before invoke resolves', async () => {
    const elsewhere = createMockInteraction(ChatInputCommandInteraction, { channelId: '222222222222222222' })

    await expect(module.invoke(ModerationSlashController, 'trade', elsewhere)).resolves.toEqual({ ran: false })

    expect(module.get(MetricsService).count('interaction', 'trade', 'denied')).toBe(1)
    expect(module.get(RefusalLog).entries).toEqual([
      {
        user: elsewhere.user.id,
        handler: 'trade',
        outcome: 'denied',
        deniedBy: ChannelGuard.name,
        at: expect.any(Date),
      },
    ])
  })

  it('are listed for each handler, in order', () => {
    expect(inspectHandler(ModerationSlashController, 'trade', { app: App }).observers).toEqual([
      CallSpanObserver,
      MetricsObserver,
      AuditObserver,
    ])
  })
})
// #endregion spec
