import { SapphireClient } from '@sapphire/framework'
import { GatewayIntentBits } from 'discord.js'

// #region client
// Message commands run once the client loads their listeners, with a prefix
export const client = new SapphireClient({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  defaultPrefix: '!',
  loadMessageCommandListeners: true,
})
// #endregion client
