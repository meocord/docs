// #region controller
import { type ChatInputCommandInteraction } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Cooldown } from 'meocord/decorator'
import { GreetingCommandBuilder } from '@src/controllers/slash/builders/greeting.builder'
import { GreetingService } from '@src/services/greeting.service'

@Controller()
export class GreetingSlashController {
  constructor(private readonly greetingService: GreetingService) {}

  @Command('greet', GreetingCommandBuilder)
  @Cooldown({ uses: 3, seconds: 10 })
  async greet(interaction: ChatInputCommandInteraction, { name }: { name: string }) {
    await respond(interaction).send({ content: this.greetingService.buildGreeting(name) })
  }
}
// #endregion controller
