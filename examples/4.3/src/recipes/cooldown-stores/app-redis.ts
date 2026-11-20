import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { createClient } from 'redis'
import { CheckInButtonController } from '@src/controllers/button/check-in.button.controller'
import { redisCooldownStore } from '@src/recipes/cooldown-stores/redis'

// #region app
const redis = await createClient({ url: process.env.REDIS_URL }).connect()

@MeoCord({
  controllers: [CheckInButtonController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  cooldownStore: redisCooldownStore(redis),
})
export default class App {}
// #endregion app
