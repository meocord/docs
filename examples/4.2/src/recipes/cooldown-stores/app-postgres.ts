import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { CheckInButtonController } from '@src/controllers/button/check-in.button.controller'
import { PostgresCooldownStore } from '@src/recipes/cooldown-stores/postgres.store'
import { databaseProvider } from '@src/recipes/database/database'

// #region app
@MeoCord({
  controllers: [CheckInButtonController],
  // The pool the store injects
  providers: [databaseProvider],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  cooldownStore: PostgresCooldownStore,
})
export default class App {}
// #endregion app
