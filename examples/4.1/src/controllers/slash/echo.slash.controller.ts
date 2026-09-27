import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, CommandBuilder, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'

// #region builder
// Describes the command to Discord: its name comes from @Command, the rest from here
@CommandBuilder(CommandType.SLASH)
export class EchoCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder()
      .setName(commandName)
      .setDescription('Repeats what you say, to you alone')
      .addStringOption(option => option.setName('text').setDescription('What to repeat').setRequired(true))
  }
}
// #endregion builder

// #region handler
@Controller()
export class EchoSlashController {
  // /echo text:hello  gives  { text: 'hello' }
  @Command('echo', EchoCommandBuilder)
  async echo(interaction: ChatInputCommandInteraction, { text }: { text: string }) {
    await respond(interaction).send({ content: text, flags: MessageFlags.Ephemeral })
  }
}
// #endregion handler
