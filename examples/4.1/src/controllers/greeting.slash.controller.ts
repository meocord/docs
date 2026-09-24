import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Cooldown } from 'meocord/decorator'
import { GreetingCommandBuilder } from '@src/controllers/builders/greeting.builder'

// #region controller
@Controller()
export class GreetingSlashController {
  @Command('greet', GreetingCommandBuilder)
  @Cooldown({ uses: 3, seconds: 10 })
  async greet(interaction: ChatInputCommandInteraction) {
    const name = interaction.options.getString('name', true)
    await respond(interaction).send({ content: `Hello, ${name}!` })
  }
}
// #endregion controller
