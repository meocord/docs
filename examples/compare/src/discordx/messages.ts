import { GatewayIntentBits } from 'discord.js'
import { Client } from 'discordx'

// #region client
// Simple commands run only when the bot hands each message to executeCommand
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
})

client.on('messageCreate', async message => {
  await client.executeCommand(message)
})
// #endregion client

export { client }
