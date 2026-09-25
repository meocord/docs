import { type ButtonInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class ProfileButtonController {
  // #region params
  // customId `profile/123/800000001` gives ownerId '123' and uid '800000001'
  @Command('profile/{ownerId}/{uid}', CommandType.BUTTON)
  async showProfile(interaction: ButtonInteraction, { ownerId, uid }: { ownerId: string; uid: string }) {
    await respond(interaction).send({ content: `Profile ${uid}, opened by <@${ownerId}>` })
  }
  // #endregion params

  // #region overlap
  // Both match `profile/summary/123/456`; the one with more literal text wins it
  @Command('profile/summary/{ownerId}/{uid}', CommandType.BUTTON)
  async showSummary(interaction: ButtonInteraction, { uid }: { uid: string }) {
    await respond(interaction).send({ content: `Summary of ${uid}` })
  }
  // #endregion overlap
}
