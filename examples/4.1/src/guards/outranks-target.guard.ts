// #region guard
import { type Message } from 'discord.js'
import { GuardDeniedError } from 'meocord/common'
import { Guard } from 'meocord/decorator'
import { type GuardInterface, type ParamRefsOf } from 'meocord/interface'

/** Lets a moderator act only on a member ranked below them. */
@Guard()
export class OutranksTargetGuard implements GuardInterface {
  async canActivate(
    message: Message,
    { target }: ParamRefsOf<'ban {target:member} {duration:duration?} {reason...?}'>,
  ) {
    // The cheap check first, so a caller without the permission costs no request, and gets no reply
    if (!message.member?.permissions.has('BanMembers')) return false
    const member = target.cached ?? (await target.resolve())
    if (member && member.roles.highest.position >= message.member.roles.highest.position) {
      throw new GuardDeniedError('You can only ban members ranked below you.')
    }
    return true
  }
}
// #endregion guard
