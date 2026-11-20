import { type GuildMember, type Message, type User } from 'discord.js'
import { Controller, MessageHandler } from 'meocord/decorator'

@Controller()
export class ModerationMessageController {
  // #region metadata
  @MessageHandler('mute {target:member} {duration:duration?} {reason...?}', {
    aliases: ['m', 'shush'],
    description: 'Times a member out, for 10 minutes unless told otherwise.',
    scope: 'guild',
  })
  async mute(
    message: Message,
    { target, duration, reason }: { target: GuildMember; duration?: number; reason?: string },
  ) {
    await target.timeout(duration ?? 600_000, reason)
    await message.reply(`Muted ${target.displayName}`)
  }
  // #endregion metadata

  // #region flags
  // !purge 50 --bots    !purge --from=@ana 20
  @MessageHandler('purge {count:int} {--bots} {--from:user?}')
  async purge(message: Message, { count, bots, from }: { count: number; bots: boolean; from?: User }) {
    if (!message.channel.isTextBased() || message.channel.isDMBased()) return
    const recent = await message.channel.messages.fetch({ limit: 100 })
    const picked = recent
      .filter(sent => (!bots || sent.author.bot) && (!from || sent.author.id === from.id))
      .first(count)
    await message.channel.bulkDelete(picked, true)
  }
  // #endregion flags

  // #region lists
  // !poll "Lunch today?" pizza "fried rice" soup
  @MessageHandler('poll {question} {options:string...}')
  async poll(message: Message, { question, options }: { question: string; options: string[] }) {
    await message.reply([question, ...options.map((option, i) => `${i + 1}. ${option}`)].join('\n'))
  }

  // !kick @ana @ben 123456789012345678
  @MessageHandler('kick {targets:member...}', { scope: 'guild' })
  async kick(message: Message, { targets }: { targets: GuildMember[] }) {
    await Promise.all(targets.map(target => target.kick()))
    await message.reply(`Kicked ${targets.length}`)
  }
  // #endregion lists
}
