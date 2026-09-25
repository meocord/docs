import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { type Score } from '@src/recipes/pagination/leaderboard.service'

// #region page
export const PAGE_SIZE = 5

/**
 * One page of the leaderboard, with buttons to its neighbours. Each button's customId carries who opened
 * the board and the page it leads to, so the bot keeps no state between clicks.
 */
export function leaderboardPage(scores: Score[], requested: number, ownerId: string) {
  const last = Math.max(0, Math.ceil(scores.length / PAGE_SIZE) - 1)
  const page = Math.min(Math.max(0, requested), last)
  const rows = scores
    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((score, index) => `${page * PAGE_SIZE + index + 1}. ${score.name}: ${score.points}`)

  const button = (label: string, target: number, disabled: boolean) =>
    new ButtonBuilder()
      .setCustomId(`leaderboard/${ownerId}/${target}`)
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
