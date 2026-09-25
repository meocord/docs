import { RateLimit, TIME_UNIT } from '@discordx/utilities'
import { ApplicationCommandOptionType, type CommandInteraction } from 'discord.js'
import { Discord, Guard, Slash, SlashOption } from 'discordx'
import { injectable } from 'tsyringe'
import { GreetingService } from './greeting.service'

// #region command
@Discord()
@injectable()
export class Greet {
  constructor(private readonly greetings: GreetingService) {}

  // The command is described by the decorators, and registered by initApplicationCommands()
  @Slash({ name: 'greet', description: 'Greets someone' })
  @Guard(RateLimit(TIME_UNIT.seconds, 10, { rateValue: 3, ephemeral: true }))
  async greet(
    @SlashOption({
      name: 'name',
      description: 'Who to greet',
      type: ApplicationCommandOptionType.String,
      required: true,
    })
    name: string,
    interaction: CommandInteraction,
  ) {
    await interaction.reply({ content: this.greetings.build(name) })
  }
}
// #endregion command
