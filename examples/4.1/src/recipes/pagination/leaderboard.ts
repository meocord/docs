import {
  ActionRowBuilder,
  ButtonBuilder,
  type ButtonInteraction,
  ButtonStyle,
  type ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js'
import { GuardDeniedError, respond, route } from 'meocord/common'
import { Command, CommandBuilder, Controller, Guard, Service, UseGuard } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type GuardInterface } from 'meocord/interface'

export interface Score {
  name: string
  points: number
}

@Service()
export class ScoreService {
  // In a real bot, read from your database
  scores(): Score[] {
    const names = ['Ada', 'Bo', 'Cy', 'Di', 'Ed', 'Flo', 'Gus', 'Hal', 'Ivy', 'Jo', 'Kai', 'Lu']
    return names.map((name, index) => ({ name, points: 1200 - index * 75 }))
  }
}

// #region page
// Who opened the board, and the page a button leads to, such as `leaderboard/111/2`
export const leaderboardPage = route('leaderboard/{ownerId}/{page:int}')

export const PAGE_SIZE = 5

/** One page of the board, with buttons to its neighbours; a page past either end shows the nearest one. */
export function renderPage(scores: Score[], requested: number, ownerId: string) {
  const last = Math.max(0, Math.ceil(scores.length / PAGE_SIZE) - 1)
  const page = Math.min(Math.max(0, requested), last)
  const rows = scores
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((score, index) => `${page * PAGE_SIZE + index + 1}. ${score.name}: ${score.points}`)

  const button = (label: string, target: number, disabled: boolean) =>
    new ButtonBuilder()
      .setCustomId(leaderboardPage.build({ ownerId, page: target }))
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled)

  return {
    embeds: [
      new EmbedBuilder()
        .setTitle('Leaderboard')
        .setDescription(rows.join('\n'))
        .setFooter({ text: `Page ${page + 1} of ${last + 1}` }),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        button('Previous', page - 1, page === 0),
        button('Next', page + 1, page === last),
      ),
    ],
  }
}
// #endregion page

// #region guard
// Only the member whose id the button carries may press it
@Guard()
export class OwnerGuard implements GuardInterface {
  canActivate(interaction: ButtonInteraction, { ownerId }: { ownerId: string }): boolean {
    // Thrown, it is answered privately; returning false would deny without a word
    if (interaction.user.id !== ownerId) throw new GuardDeniedError('Only the member who opened this can use it.')
    return true
  }
}
// #endregion guard

@CommandBuilder(CommandType.SLASH)
export class LeaderboardCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder().setName(commandName).setDescription('Show the leaderboard')
  }
}

// #region controller
@Controller()
export class LeaderboardController {
  constructor(private readonly scores: ScoreService) {}

  @Command('leaderboard', LeaderboardCommandBuilder)
  async show(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send(renderPage(this.scores.scores(), 0, interaction.user.id))
  }

  // The page arrives as a number; send() updates the message the button is on
  @Command(leaderboardPage, CommandType.BUTTON)
  @UseGuard(OwnerGuard)
  async turn(interaction: ButtonInteraction, { ownerId, page }: { ownerId: string; page: number }) {
    await respond(interaction).send(renderPage(this.scores.scores(), page, ownerId))
  }
}
// #endregion controller
