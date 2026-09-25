import { type ChatInputCommandInteraction, type GuildMember, MessageFlags } from 'discord.js'
import { respond } from 'meocord/common'
import { Command, Controller, On } from 'meocord/decorator'
import { AnnounceCommandBuilder } from '@src/recipes/i18n/announce.builder'
import { t } from '@src/recipes/i18n/i18n'

// #region controller
@Controller()
export class AnnounceController {
  // Interactions report the default name, so the route is `announce` in every language
  @Command('announce', AnnounceCommandBuilder)
  async announce(interaction: ChatInputCommandInteraction, { message }: { message: string }) {
    // What everyone sees, in the server's language
    const everyone = t.for(interaction, { public: true })
    await respond(interaction).send({ content: `**${everyone('announce.heading')}**\n${message}` })
    // What only the author sees, in their own
    await respond(interaction).followUp({
      content: t.for(interaction)('announce.posted'),
      flags: MessageFlags.Ephemeral,
    })
  }

  // An event has no user locale: greet in the server's
  @On('guildMemberAdd')
  async welcome(member: GuildMember) {
    const text = t.forGuild(member.guild)('welcome', { server: member.guild.name, user: member.toString() })
    await member.guild.systemChannel?.send({ content: text })
  }
}
// #endregion controller
