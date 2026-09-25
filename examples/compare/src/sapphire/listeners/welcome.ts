import { Events, Listener } from '@sapphire/framework'
import { type GuildMember } from 'discord.js'

// #region listener
export class WelcomeListener extends Listener<typeof Events.GuildMemberAdd> {
  constructor(context: Listener.LoaderContext, options: Listener.Options) {
    super(context, { ...options, event: Events.GuildMemberAdd })
  }

  override async run(member: GuildMember) {
    await member.send(`Welcome to ${member.guild.name}!`)
  }
}
// #endregion listener
