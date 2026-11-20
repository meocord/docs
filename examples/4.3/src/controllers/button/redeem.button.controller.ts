import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Pipe, UseFilter, UseInterceptor, Validate } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type PipeInterface } from 'meocord/interface'
import { z } from 'zod'
import { UnknownAccountError, UnknownAccountFilter } from '@src/filters/unknown-account.filter'
import { AuditInterceptor } from '@src/interceptors/audit.interceptor'
import { type Account, AccountService } from '@src/services/account.service'

/** Turns a uid into its account, refusing one that does not exist. */
@Pipe()
export class RedeemAccountPipe implements PipeInterface<string, Account> {
  constructor(private readonly accounts: AccountService) {}

  transform(uid: string): Account {
    try {
      return this.accounts.find(uid)
    } catch {
      throw new UnknownAccountError(`No account ${uid}`)
    }
  }
}

@Controller()
export class RedeemButtonController {
  // #region controller
  @Command('redeem/{uid}', CommandType.BUTTON)
  @Validate(z.object({ uid: z.string().regex(/^\d{9,10}$/) }), { pipes: { uid: RedeemAccountPipe } })
  @UseInterceptor(AuditInterceptor)
  @UseFilter(UnknownAccountFilter)
  async redeem(interaction: ButtonInteraction, { uid }: { uid: Account }) {
    await respond(interaction).send({ content: `Redeemed for ${uid.name}.` })
  }
  // #endregion controller
}
