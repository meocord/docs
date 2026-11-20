import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { SayController } from '@src/security/say.controller'

// #region app
@MeoCord({
  controllers: [SayController],
  clientOptions: {
    // Only the intents the bot uses; privileged ones need a reason and Discord's approval
    intents: [GatewayIntentBits.Guilds],
    // The default for every message: members can be pinged, @everyone and roles never
    allowedMentions: { parse: ['users'], repliedUser: false },
  },
})
export default class App {}
// #endregion app
