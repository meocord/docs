import { Injectable } from '@nestjs/common'
import { Context, type ContextOf, On } from 'necord'

// #region listener
@Injectable()
export class WelcomeListener {
  @On('guildMemberAdd')
  async greet(@Context() [member]: ContextOf<'guildMemberAdd'>) {
    await member.send(`Welcome to ${member.guild.name}!`)
  }
}
// #endregion listener
