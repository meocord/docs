import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Cooldown, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { OwnerGuard } from '@src/guards/owner.guard'

@Controller()
export class CheckInButtonController {
  // #region by
  // One check-in an hour for each game account: a user with three accounts can check each of them in
  @Command('check-in/{ownerId}/{uid}', CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  @Cooldown({ seconds: 3600, by: (_context, { uid }: { uid: string }) => uid })
  async checkIn(interaction: ButtonInteraction, { uid }: { ownerId: string; uid: string }) {
    await respond(interaction).send({ content: `Checked in account ${uid}.` })
  }
  // #endregion by
}
