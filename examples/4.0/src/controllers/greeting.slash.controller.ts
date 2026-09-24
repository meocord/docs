import { type ChatInputCommandInteraction } from 'discord.js'
import { Command, Controller } from 'meocord/decorator'
import { GreetingCommandBuilder } from '@src/controllers/builders/greeting.builder'

// #region controller
@Controller()
export class GreetingSlashController {
  @Command('greet', GreetingCommandBuilder)
  async greet(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name', true)
    await interaction.reply({ content: `Hello, ${name}!` })
  }
}
// #endregion controller
