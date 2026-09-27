import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { RequireRoles } from '@src/guards/roles.guard'

// #region base
@Controller()
@RequireRoles('moderator')
export abstract class StaffSlashController {}

@Controller()
export class MuteSlashController extends StaffSlashController {
  // Runs RolesGuard, from the base class, before the command
  @Command('mute', CommandType.SLASH)
  async mute(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({ content: 'Muted.' })
  }
}
// #endregion base
