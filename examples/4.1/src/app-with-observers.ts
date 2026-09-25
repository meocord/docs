// #region app
import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { ModerationSlashController } from '@src/controllers/slash/moderation.slash.controller'
import { HandlerSpanInterceptor } from '@src/interceptors/handler-span.interceptor'
import { AuditObserver } from '@src/observers/audit.observer'
import { CallSpanObserver } from '@src/observers/call-span.observer'
import { MetricsObserver } from '@src/observers/metrics.observer'

@MeoCord({
  controllers: [ModerationSlashController],
  interceptors: [HandlerSpanInterceptor],
  // Told in this order, each on its own: one that throws is logged, and the next is still told
  observers: [CallSpanObserver, MetricsObserver, AuditObserver],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
})
export default class App {}
// #endregion app
