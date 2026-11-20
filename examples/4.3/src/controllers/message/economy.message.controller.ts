import { type GuildMember, type Message } from 'discord.js'
import { Controller, MessageHandler, UseGuard } from 'meocord/decorator'
import { OutranksTargetGuard } from '@src/guards/outranks-target.guard'

@Controller()
export class EconomyMessageController {
  // #region typed
  // !pay @ana 25 for lunch    !pay 123456789012345678 25
  @MessageHandler('pay {to:member} {amount:int} {note...?}')
  async pay(message: Message, { to, amount, note }: { to: GuildMember; amount: number; note?: string }) {
    await message.reply(`Paid ${to.displayName} ${amount}${note ? ` ${note}` : ''}`)
  }
  // #endregion typed

  // #region optionals
  // !ban @ana spamming      gives { target, reason: 'spamming' }
  // !ban @ana 7d spamming   gives { target, duration: 604_800_000, reason: 'spamming' }
  @MessageHandler('ban {target:member} {duration:duration?} {reason...?}')
  @UseGuard(OutranksTargetGuard)
  async ban(
    message: Message,
    { target, duration, reason }: { target: GuildMember; duration?: number; reason?: string },
  ) {
    await target.ban({ reason, deleteMessageSeconds: duration ? Math.min(duration / 1000, 604_800) : undefined })
    await message.reply(`Banned ${target.displayName}`)
  }
  // #endregion optionals
}
