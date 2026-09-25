import { SlashCommandBuilder } from 'discord.js'
import { CommandBuilder } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { type CommandBuilderBase } from 'meocord/interface'

// #region builder
@CommandBuilder(CommandType.SLASH, { guilds: [process.env.STAFF_GUILD_ID] })
export class BanCommandBuilder implements CommandBuilderBase {
  build(commandName: string) {
    return new SlashCommandBuilder().setName(commandName).setDescription('Ban a member')
  }
}
// #endregion builder
