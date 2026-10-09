import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { createClient } from 'redis'
import { CheckInButtonController } from '@src/controllers/button/check-in.button.controller'
import { redisCooldownStore } from '@src/recipes/cooldown-stores/redis'

const redis = await createClient({ url: process.env.REDIS_URL }).connect()

// #region app
@MeoCord({
  controllers: [CheckInButtonController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  cooldownStore: redisCooldownStore(redis),
  // While Redis is unreachable, calls run uncounted rather than being refused
  cooldownStoreFailure: 'allow',
  // Wait half a second for an answer, not the default second
  cooldownStoreTimeoutMs: 500,
})
export default class App {}
// #endregion app
