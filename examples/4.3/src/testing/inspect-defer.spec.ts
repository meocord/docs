import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Defer } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { inspectHandler } from 'meocord/testing'
import { describe, expect, it } from 'vitest'

@Controller()
class ReportController {
  @Command('report', CommandType.SLASH)
  @Defer({ ephemeral: true })
  async report(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send('Report filed.')
  }
}

describe('inspectHandler', () => {
  // #region defer
  it('reports the deferral the bot applies, with its defaults', () => {
    expect(inspectHandler(ReportController, 'report').defer).toEqual({
      ephemeral: true,
      suppressNotifications: false,
      disable: 'all',
      mode: 'eager',
    })
  })
  // #endregion defer
})
