// #region app
import { GatewayIntentBits } from 'discord.js'
import { MeoCord } from 'meocord/decorator'
import { DiceMessageController } from '@src/controllers/message/dice.message.controller'

// Each server's prefix, as a settings command stores it; a real bot would load it from its database
export const guildPrefixes = new Map<string, string>()

@MeoCord({
  controllers: [DiceMessageController],
  clientOptions: {
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  },
  messages: {
    // Read for every message; it may be async, and may return a list
    prefix: message => (message.guildId ? guildPrefixes.get(message.guildId) : undefined) ?? '!',
    mention: true,
  },
})
export default class GuildPrefixApp {}
// #endregion app
