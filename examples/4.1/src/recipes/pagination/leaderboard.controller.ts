import { type ButtonInteraction, type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { OwnerGuard } from '@src/guards/owner.guard'
import { LeaderboardCommandBuilder } from '@src/recipes/pagination/leaderboard.builder'
import { leaderboardPage } from '@src/recipes/pagination/leaderboard.page'
import { LeaderboardService } from '@src/recipes/pagination/leaderboard.service'

// #region controller
@Controller()
export class LeaderboardController {
  constructor(private readonly leaderboard: LeaderboardService) {}

  @Command('leaderboard', LeaderboardCommandBuilder)
  async show(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send(leaderboardPage(this.leaderboard.scores(), 0, interaction.user.id))
  }

  // Only the user who opened the board turns its pages; send() updates the message the button is on
  @Command('leaderboard/{ownerId}/{page}', CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  async turn(interaction: ButtonInteraction, { ownerId, page }: { ownerId: string; page: string }) {
    await respond(interaction).send(leaderboardPage(this.leaderboard.scores(), Number(page), ownerId))
  }
}
// #endregion controller
