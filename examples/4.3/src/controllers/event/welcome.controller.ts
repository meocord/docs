// #region controller
import { type Client, type GuildMember } from 'discord.js'
import { Controller, On, Once } from 'meocord/decorator'

@Controller()
export class WelcomeController {
  // Every time a member joins; needs the GuildMembers intent
  @On('guildMemberAdd')
  async greet(member: GuildMember) {
    await member.send(`Welcome to ${member.guild.name}!`)
  }

  // The first time the client is ready, and never again
  @Once('clientReady')
  async warmCache(client: Client<true>) {
    await client.guilds.fetch()
  }
}
// #endregion controller
