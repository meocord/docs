import { Discord, On, type ArgsOf } from 'discordx'

// #region listener
@Discord()
export class Welcome {
  @On({ event: 'guildMemberAdd' })
  async greet([member]: ArgsOf<'guildMemberAdd'>) {
    await member.send(`Welcome to ${member.guild.name}!`)
  }
}
// #endregion listener
