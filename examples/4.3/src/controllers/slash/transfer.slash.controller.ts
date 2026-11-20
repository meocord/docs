import { type ChatInputCommandInteraction } from 'discord.js'
import { respond, UserError } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

/** Each user's coins, kept in memory for the example. */
export const balances = new Map<string, number>()

// #region user-error
@Controller()
export class TransferSlashController {
  @Command('transfer', CommandType.SLASH)
  async transfer(interaction: ChatInputCommandInteraction, { amount }: { amount: number }) {
    const balance = balances.get(interaction.user.id) ?? 0
    // The user's own mistake: shown only to them, and no fault of the bot to log
    if (amount > balance) {
      throw new UserError(`You have ${balance} coins, ${amount - balance} short of ${amount}.`, {
        code: 'wallet.short',
        context: { balance, amount },
      })
    }
    balances.set(interaction.user.id, balance - amount)
    await respond(interaction).send({ content: `Sent ${amount} coins.` })
  }
}
// #endregion user-error
