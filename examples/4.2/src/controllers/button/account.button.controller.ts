import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Validate } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { z } from 'zod'
import { AccountPipe } from '@src/pipes/account.pipe'
import { type Account } from '@src/services/account.service'

@Controller()
export class AccountButtonController {
  // #region pipes
  // The pattern captures a uid; the schema checks it, and the pipe turns it into an account
  @Command('account/{uid}', CommandType.BUTTON)
  @Validate(z.object({ uid: z.string().regex(/^\d{9,10}$/) }), { pipes: { uid: AccountPipe } })
  async show(interaction: ButtonInteraction, { uid }: { uid: Account }) {
    await respond(interaction).send({ content: `Account of ${uid.name}` })
  }
  // #endregion pipes
}
