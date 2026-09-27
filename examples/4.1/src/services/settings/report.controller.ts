import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, CommandBuilder, Controller } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { ReportService } from '@src/services/settings/settings'

@CommandBuilder(CommandType.SLASH)
export class ReportCommandBuilder {
  build(commandName: string) {
    return new SlashCommandBuilder().setName(commandName).setDescription('Where reports go')
  }
}

@Controller()
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Command('report', ReportCommandBuilder)
  async where(interaction: ChatInputCommandInteraction) {
    await respond(interaction).send({
      content: `Reports go to <#${this.reports.channelId()}>.`,
      flags: MessageFlags.Ephemeral,
    })
  }
}
