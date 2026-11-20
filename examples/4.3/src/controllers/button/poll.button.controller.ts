import { type ButtonInteraction } from 'discord.js'
import { OwnerGuard, respond } from 'meocord/common'
import { Command, Controller, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@Controller()
export class PollButtonController {
  // #region owner
  // Only the user the route's ownerId names may see the results early
  @Command('poll/{pollId}/{ownerId:snowflake}/results', CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  async results(interaction: ButtonInteraction, { pollId }: { pollId: string }) {
    await respond(interaction).send({ content: `Results of poll ${pollId} so far.` })
  }

  // Another param, and the app's own words for anyone else
  @Command('poll/{pollId}/{authorId:snowflake}/close', CommandType.BUTTON)
  @UseGuard({ provide: OwnerGuard, params: { param: 'authorId', message: 'Only the author can close this poll.' } })
  async close(interaction: ButtonInteraction, { pollId }: { pollId: string }) {
    await respond(interaction).send({ content: `Poll ${pollId} is closed.` })
  }
  // #endregion owner
}
