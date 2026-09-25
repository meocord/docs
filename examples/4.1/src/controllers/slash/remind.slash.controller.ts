import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, Validate } from 'meocord/decorator'
import { CommandType } from 'meocord/enum'
import { z } from 'zod'

// #region validate
const Reminder = z.object({
  minutes: z.number().int().min(1).max(1440),
  note: z.string().max(200).default(''),
})

@Controller()
export class RemindSlashController {
  @Command('remind', CommandType.SLASH)
  @Validate(Reminder)
  // The second parameter is checked against the schema's output: `{ minutes: string }` would not compile
  async remind(interaction: ChatInputCommandInteraction, { minutes, note }: z.output<typeof Reminder>) {
    await respond(interaction).send({
      content: `In ${minutes} minutes: ${note || 'a reminder'}`,
      flags: MessageFlags.Ephemeral,
    })
  }
}
// #endregion validate
