import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { StoreSlashController } from '@src/controllers/slash/store.slash.controller'
import { VoteSlashController } from '@src/controllers/slash/vote.slash.controller'

// #region app
@MeoCord({
  controllers: [StoreSlashController, VoteSlashController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  // Only what changes: every other role keeps MeoCord's default
  theme: { colors: { primary: '#5865F2' }, emojis: { success: '🎉' } },
})
export default class App {}
// #endregion app
