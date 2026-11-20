import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class ProfileButtonController {
  // #region params
  // customId `profile/175928847299117063/800000001` gives ownerId '175928847299117063' and uid '800000001'
  @Command('profile/{ownerId:snowflake}/{uid}', CommandType.BUTTON)
  async showProfile(interaction: ButtonInteraction, { ownerId, uid }: { ownerId: string; uid: string }) {
    await respond(interaction).send({ content: `Profile ${uid}, opened by <@${ownerId}>` })
  }
  // #endregion params

  // #region overlap
  // Both match `profile/175928847299117063/summary`; `summary`, literal where the other has a param, wins it
  @Command('profile/{ownerId:snowflake}/summary', CommandType.BUTTON)
  async showSummary(interaction: ButtonInteraction, { ownerId }: { ownerId: string }) {
    await respond(interaction).send({ content: `Summary for <@${ownerId}>` })
  }
  // #endregion overlap
}
