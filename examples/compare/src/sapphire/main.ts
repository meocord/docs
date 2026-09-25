import { SapphireClient } from '@sapphire/framework'
import { GatewayIntentBits } from 'discord.js'
import './greeting.service'

// #region client
// Commands, handlers and listeners are loaded from folders next to the entry point
const client = new SapphireClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] })

await client.login(process.env.DISCORD_TOKEN)
// #endregion client
