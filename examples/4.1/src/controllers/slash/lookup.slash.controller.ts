import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, UseInterceptor } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { ReportingInterceptor } from '@src/interceptors/reporting.interceptor'
import { TimingInterceptor } from '@src/interceptors/timing.interceptor'

// #region controller
// The first listed is outermost: timing covers the reporting too
@Controller()
@UseInterceptor(TimingInterceptor, ReportingInterceptor)
export class LookupSlashController {
  @Command('lookup', CommandType.SLASH)
  async lookup(interaction: ChatInputCommandInteraction, { id }: { id: string }) {
    if (!/^\d+$/.test(id)) throw new Error(`"${id}" is not an id`)
    await respond(interaction).send({ content: `Looking up ${id}…` })
  }
}
// #endregion controller
