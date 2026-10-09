import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, CommandBuilder, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { WeatherService } from '@src/services/weather/weather.service'

@CommandBuilder(CommandType.SLASH)
export class WeatherCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('The temperature in a city')
      .addStringOption(option => option.setName('city').setDescription('Which city').setRequired(true))
  }
}

@Controller()
export class WeatherController {
  constructor(private readonly weather: WeatherService) {}

  @Command('weather', WeatherCommandBuilder)
  async show(interaction: ChatInputCommandInteraction, { city }: { city: string }) {
    await respond(interaction).send({ content: await this.weather.report(city) })
  }
}
