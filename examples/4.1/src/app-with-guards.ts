import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { GreetingSlashController } from '@src/controllers/slash/greeting.slash.controller'
import { BlocklistGuard } from '@src/guards/blocklist.guard'

@MeoCord({
  controllers: [GreetingSlashController],
  clientOptions: { intents: [GatewayIntentBits.Guilds] },
  guards: [BlocklistGuard],
})
export default class App {}
