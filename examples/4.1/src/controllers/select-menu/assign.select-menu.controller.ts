import { type UserSelectMenuInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class AssignSelectMenuController {
  // #region user-select
  @Command('assign/{taskId}', CommandType.USER_SELECT_MENU)
  async assign(interaction: UserSelectMenuInteraction, { taskId }: { taskId: string }) {
    const names = interaction.users.map(user => user.username).join(', ')
    await respond(interaction).send({ content: `Task ${taskId} is assigned to ${names}.` })
  }
  // #endregion user-select
}
