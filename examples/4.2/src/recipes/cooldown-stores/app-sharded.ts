import { GatewayIntentBits } from 'discord.js'
import { ShardedCooldownStore } from 'meocord/common'
import { MeoCord } from 'meocord/decorator'
import { CheckInButtonController } from '@src/controllers/button/check-in.button.controller'

// #region app
@MeoCord({
  controllers: [CheckInButtonController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  // Every shard's calls counted in the shard manager, over the IPC the shards already use
  cooldownStore: ShardedCooldownStore,
})
export default class App {}
// #endregion app
