import 'reflect-metadata'
import { DIService, tsyringeDependencyRegistryEngine } from '@discordx/di'
import { dirname, importx } from '@discordx/importer'
import { GatewayIntentBits } from 'discord.js'
import { Client } from 'discordx'
import { container } from 'tsyringe'

// #region client
DIService.engine = tsyringeDependencyRegistryEngine.setInjector(container)

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] })

// Registration, and passing interactions on, are the bot's to wire up
client.once('clientReady', async () => {
  await client.initApplicationCommands()
})
client.on('interactionCreate', interaction => {
  client.executeInteraction(interaction)
})

// Every decorated class is found by importing the files that declare it
await importx(`${dirname(import.meta.url)}/{greet,card,welcome}.ts`)
await client.login(process.env.DISCORD_TOKEN!)
// #endregion client
