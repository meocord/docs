import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

@CommandBuilder(CommandType.SLASH)
export class LeaderboardCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder().setName(commandName).setDescription('Show the leaderboard')
  }
}
