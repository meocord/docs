import { type AutocompleteInteraction, type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Autocomplete, Command, Controller } from 'meocord/decorator'
import { SearchCommandBuilder } from '@src/controllers/slash/builders/search.builder'
import { CatalogService } from '@src/services/catalog.service'

// #region controller
@Controller()
export class SearchSlashController {
  constructor(private readonly catalog: CatalogService) {}

  @Command('search', SearchCommandBuilder)
  async search(interaction: ChatInputCommandInteraction, { query }: { query: string }) {
    await respond(interaction).send({ content: `Results for ${query}` })
  }

  @Autocomplete('search', 'query')
  async completeQuery(interaction: AutocompleteInteraction) {
    const { value } = interaction.options.getFocused(true)
    // Discord shows at most 25 choices
    const matches = this.catalog.find(value).slice(0, 25)

    await interaction.respond(matches.map(name => ({ name, value: name })))
  }
}
// #endregion controller
